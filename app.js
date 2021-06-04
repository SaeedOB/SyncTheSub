const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const fs = require('fs')


const app = express();

// enable files upload
app.use(fileUpload());

//add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(morgan('dev'));
app.use(express.static('public'))


const port = 3000;

// -----------------------------------------------------------------------------


function parseTime(str) {
  var elems = str.replace(',', '.').split(':').map(parseFloat);
  return elems[0] * 3600 + elems[1] * 60 + elems[2];
}

function stringifyTime(t) {
  var h = Math.floor(t / 3600);
  var m = Math.floor((t - h * 3600) / 60);
  var s = (t - h * 3600 - m * 60).toFixed(3);
  return [h, m, s].map(padz).join(':').replace('.', ',');
}


function parseUserInput(spec) {
  var [t_1, t_2] = [parseTime(spec.firstTimeStamp), parseTime(spec.secondTimeStamp)];
  var [shift_1, shift_2] = [spec.firstTimeFix, spec.secondTimeFix]
  return [{
    at: t_1,
    shift: parseFloat(shift_1, 10)
  }, {
    at: t_2,
    shift: parseFloat(shift_2, 10)
  }];
}

function padz(n) {
  return n >= 10 ? n : '0' + n;
}

function createShifter(specs) {
  return function(pos) {
    var start = specs[0],
      end = specs[1];
    // console.log('inside createShifter function are: ', start, end);
    var slope = (end.shift - start.shift) / (end.at - start.at);
    // console.log('this is slope: ', slope);
    var shift = start.shift + (slope * (pos - start.at))
    // console.log('this is shift: ', shift);
    // console.log('this is pos: ', pos);
    var output = pos + shift;
    output = parseFloat(output)
    // console.log('this is output: ', output);
    return output;
  }
}

function createWorkingFile(filename) {
  var sub = [];
  var test = '';
  sub.push(fs.readFileSync(__dirname + '/uploads/' + filename, 'utf8'));
  var lines = sub.join('').split(/\r*\n/);
  var subs = [];
  var expect = 'new';
  var last;
  lines.forEach(function(l) {
    if (expect == 'new') {
      last = {
        id: parseInt(l, 10),
        text: ''
      };
      if (!isNaN(last.id)) expect = 'time';
    } else if (expect == 'time') {
      var twoTimes = l.split(/\s+-+>\s+/);
      last.start = parseTime(twoTimes[0]);
      last.end = parseTime(twoTimes[1]);
      expect = 'text_end';
    } else {
      if (l.match(/^\s*$/)) {
        subs.push(last);
        expect = 'new';
      } else last.text += l + '\r\n';
    }
  });
  return subs;
}

function shiftSubs(subs) {

}

function main(filename, userInput) {
  // let wStream = fs.createWriteStream(__dirname + '/output.srt');
  let wStream = fs.createWriteStream(__dirname + '/'
  + filename.replace(/\w+(?=\.)/g, filename.match(/\w+(?=\.)/g) + '_fixedOutput'));

  const subs = createWorkingFile(filename);
  const specs = parseUserInput(userInput); // should return two objects, { at: t_i, shift: s_i }
  console.log(specs);
  console.log(filename);
  var shifter = createShifter(specs);
  subs.forEach(function(sub) {
    sub.start = shifter(sub.start);
    sub.end = shifter(sub.end);
  })

  subs
    .map(function(sub) {
      return [sub.id, '\r\n', stringifyTime(sub.start), ' --> ', stringifyTime(sub.end), '\r\n', sub.text, '\r\n'].join('')
    })
    .forEach(function(str) {
      wStream.write(str, (err) => {
        if (err) {
          console.log(err);
        } else {
        }
      })
    });



}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

app.post('/', (req, res) => {
  if (req.files) {
    var file = req.files.subtitleFile;
    var filename = file.name;
    file.mv(__dirname + '/uploads/' + filename, function(err) {

      main(filename, req.body);
    })
  }

});



app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

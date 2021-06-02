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
    var elems = str.replace(',','.').split(':').map(parseFloat);
    // console.log('elems are ', elems);
    return elems[0] * 3600 + elems[1] * 60 + elems[2];
}

function stringifyTime(t) {
    var h = Math.floor(t/3600);
    var m = Math.floor((t - h * 3600) / 60);
    var s = (t - h * 3600 - m * 60).toFixed(3);
    return [h,m,s].map(padz).join(':').replace('.',',');
}

function parseSpec(spec) {
    var positive = ~spec.indexOf('+');
    var timepos = spec.split(/[-+]/);
    var t = parseTime(timepos[0]),
        shift = parseFloat(timepos[1]);
    if (!positive) shift = 0 - shift;
    return { at: t, shift: shift };
}

function padz(n) { return n >= 10 ? n : '0'+n; }

function createShifter(specs) {
    return function(pos) {
       for (var k = 1; specs[k].at < pos; ++k);
       var start = specs[k-1], end = specs[k];
       var percent = (pos - start.at) / (end.at - start.at)
       var shift = start.shift + percent * (end.shift - start.shift);
       return (pos + shift) > 0 ? pos + shift : 0;
    }
}

function createWorkingFile(filename) {
  var sub = [];
  var test = '';

  fs.readFile(__dirname + '/uploads/' + filename, 'utf8', (err, data) => {
    if (err) {
      console.log(err)
    }
    sub.push(data);
    // console.log(data);
    console.log(sub);
    var lines = sub.join('').split(/\r*\n/);
    var subs = [];
    // var expect = 'new', last;
    var expect = 'new';
    var last;
    console.log(expect);
    let counter = 0;
    lines.forEach(function(l) {

      console.log('line element is ', l);
        if (expect == 'new') {
            last = {id: parseInt(l, 10), text:''};
            if (!isNaN(last.id)) expect = 'time';
        } else if (expect == 'time') {
            var twoTimes = l.split(/\s+-+>\s+/);
            // console.log('log of twoTimes', twoTimes);
            last.start = parseTime(twoTimes[0]);
            last.end = parseTime(twoTimes[1]);
            expect = 'text_end';
        }
        else {
            if (l.match(/^\s*$/)) {
                subs.push(last);
                expect = 'new';
            }
            else last.text += l + '\r\n';
        }
    });
    console.log(lines);
    console.log(lines.length);
    console.log(subs);
    console.log(subs.length);

  })
  return subs
}
function main() {

  const subs = createWorkingFile(filename)

}

app.get('/', (req, res) => {
  // console.log('whatsup')
  res.sendFile(__dirname + '/index.html')
})

app.post('/', (req, res) => {
  console.log(req.body);
  if (req.files) {
    // console.log(req.files);
    var file = req.files.subtitleFile
    var filename = file.name;
    console.log(filename);
    file.mv(__dirname + '/uploads/' + filename, function(err) {

      main(filename);
      // res.send('file uploaded')
    })
  }

});



app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

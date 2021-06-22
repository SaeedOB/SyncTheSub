const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const fs = require('fs')
const https = require('https');
const mongoose = require('mongoose');

//-- configuring a mongooDB database -------------------------------------------
const atlasUrl = 'mongodb+srv://admin:admin@movieposters.lljl0.mongodb.net/myFirstDatabase?retryWrites=true&w=majority'
const baseUrl = 'https://image.tmdb.org/t/p/w185'

mongoose.connect(atlasUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => {
    console.log('MongoDB Connected…');
  })
  .catch(err => console.log(err));

const posterLink = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  posterID: {
    type: Number,
    required: true
  }
});

const Poster = mongoose.model('Poster', posterLink);

const backgroundPosters = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  posterID: {
    type: Number,
    required: true
  }
});

const BackgroundPoster = mongoose.model('BackgroundPoster', backgroundPosters);

const app = express();

app.use(fileUpload());
app.set('view engine', 'ejs');
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(morgan('dev'));
app.use(express.static('public'))


const port = 3000;

// -----------------------------------------------------------------------------
async function addToMongoDB(record) {
  return BackgroundPoster.create(record);
}

async function readBackgroundPosters() {
  return BackgroundPoster.find({}).exec();
}

async function produceListOfPosters() {
  await BackgroundPoster.deleteMany({}, function() {
    console.log('success in deleting many');
  }).exec();
  const promises = [];
  const mongoCreatePromises = [];
  const count = await Poster.count();
  console.log('count is ', count);
  for (var x = 0; x < 60; x++) {
    var random = Math.floor(Math.random() * count)
    const tempPoster = Poster.findOne().skip(random).exec();
    promises.push(tempPoster)
  }
  const postersList = await Promise.all(promises);
  for (const result of postersList) {
    const record = {
      url: result.url,
      posterID: result.posterID
    };
    mongoCreatePromises.push(addToMongoDB(record))
  }
  await Promise.all(mongoCreatePromises);
}

function fetchRandomPosters() {
  var randomInt = Math.floor(Math.random() * 100000);
  const apiMoviePosterCall = 'https://api.themoviedb.org/3/movie/' + randomInt + '/images?api_key=ac6f9409a8ade08e0059a315b3c807bc&language=en-US&include_image_language=en%2C%20null'
}

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
    var slope = (end.shift - start.shift) / (end.at - start.at);
    var shift = start.shift + (slope * (pos - start.at))
    var output = pos + shift;
    output = parseFloat(output)
    return output > 0 ? output : 0;
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

function main(filename, userInput) {
  // let wStream = fs.createWriteStream(__dirname + '/' +
  //   filename.replace(/\w+(?=\.)/g, filename.match(/\w+(?=\.)/g) + '_fixedOutput'));
  let wStream = fs.createWriteStream(__dirname + '/' + 'output.srt');

  const subs = createWorkingFile(filename);
  const specs = parseUserInput(userInput);
  console.log('specs are: ', specs);
  console.log('filename is: ', filename);
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
        } else {}
      })
    });
}

app.get('/', async (req, res) => {
  await produceListOfPosters();
  const posters = await readBackgroundPosters();
  res.render('home', {
    posters: posters,
  });
});

app.post('/', async (req, res) => {
  if (req.files) {
    var file = req.files.subtitleFile;
    var filename = file.name;
    file.mv(__dirname + '/uploads/' + filename, async function(err) {
      main(filename, req.body);
      res.redirect('/download');
    })
  }
});

app.get('/download', async (req, res) => {
  const posters = await readBackgroundPosters();
  res.render('download', {
    posters: posters,
  })
})

app.post('/download', async (req, res) => {
  res.download('./output.srt')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

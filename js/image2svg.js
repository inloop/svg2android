var API_ENDPOINT = 'http://api2.online-convert.com';
var API_KEY = '78cb06aefacf79bbaabd82742a1f7f39';

// I am intentionally not using ES6 to keep the whole project consistent in ES5
// would have been an easier task if async-await or promises were used, but who cares right? :P

var img2svgConverter = function (file, type, cb) {
  startJob(type, function (err, job) {
    if(err) {
      throw err;
    }
    var link = job.server + '/upload-file/' + job.id;
    sendFileToJob(link, file, cb);
  });
};

function startJob(type, cb) {
  var data = {
    conversion: [{
      category: 'image',
      target: 'png',
    }],
  };

  $.ajax({
    url: API_ENDPOINT + '/jobs',
    type: 'POST',
    data: JSON.stringify(data),
    contentType: 'application/json',
    dataType: 'json',
    headers: {
      'x-oc-api-key': API_KEY,
    },
    beforeSend: function () {
      console.log('Starting Img to svg...');
      // show some kind of loader
    },
    success: function (res) {
      console.log(res);
      cb(null, res);
    },
    error: function (xhr) {
      cb(xhr);
    },
    complete: function () {
      // hide loader
    }
  });
}

function sendFileToJob(link, file, cb) {
  //TODO: modify file.name to append uuid string in it
  var data = new FormData();
  console.log(file);
  data.append('file', file);
  console.log(data.get('file'));
  $.ajax({
    url: link,
    type: "POST",
    data: data,
    contentType: false,
    cache: false,
    processData: false,
    headers: {
      'x-oc-api-key': API_KEY,
    },
    success: function (res) {
      console.log(res);
    },
    error: function (xhr) {
      console.log(xhr);
    }
  });
}

function getJobStatus() {
  
}
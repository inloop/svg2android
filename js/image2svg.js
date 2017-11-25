var API_ENDPOINT = 'http://api2.online-convert.com';
var API_KEY = '78cb06aefacf79bbaabd82742a1f7f39';

// I am intentionally not using ES6 to keep the whole project consistent in ES5
// would have been an easier task if async-await or promises were used,
// but who cares when you know how to deal with callback hell, right?  :P

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
      target: 'svg',
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
      pollJobStatus(res.id.job, function (err, url) {
        downloadFile(url, cb);
      });
    },
    error: function (xhr) {
      console.log(xhr);
      cb(xhr);
    }
  });
}

function pollJobStatus(jobId, cb) {
  var ref = setInterval(function () {
    $.ajax({
      url: API_ENDPOINT + '/jobs/' + jobId,
      method: 'GET',
      headers: {
        'x-oc-api-key': API_KEY,
      },
      success: function (res) {
        if(res.status.code === 'completed') {
          clearInterval(ref);
          cb(null, res.output[0].uri); // for now
        }
      },
      error: function (xhr) {
        clearInterval(ref);
        console.log(xhr);
      }
    });
  }, 1000);
}

function downloadFile(url, cb) {
  $.ajax({
    url: url,
    method: 'GET',
    success: function (res) {
      var oSerializer = new XMLSerializer();
      var sXML = oSerializer.serializeToString(res);
      cb(null, sXML);
    },
    error(xhr) {
      cb(xhr);
    }
  })
}
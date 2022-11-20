function dec2hex (dec) {
    return dec.toString(16).padStart(2, "0")
  }
  
  // generateId :: Integer -> String
function generateId (len) {
    var arr = new Uint8Array((len || 40) / 2)
    window.crypto.getRandomValues(arr)
    return Array.from(arr, dec2hex).join('')
}


function postAnimeId(id, title) {
  $('.loading')[0].classList.toggle('show')
  fetch(`/search?selected=${id}&search=${title}`, {method: 'GET', redirect: 'follow'}).then((response) => {
    if (response.redirected) {
      window.location.href = response.url;
    }
  })
}

function gotoUrl(url) {
  window.location.href = url;
}

setInterval(() => {
  var startDateFields = $('.start-date');
  var ignoreDateFields = []

  for(var i = 0; i < startDateFields.length; i++) {
    if(ignoreDateFields.find(dataFields => dataFields == startDateFields[i]) == null) {
      var timeDiff = new Date(parseInt(startDateFields[i].attributes.value.value)).getTime() - new Date().getTime()
      if(timeDiff <= 0) {
        startDateFields[i].innerText = '00:00:00'
        ignoreDateFields.push(startDateFields[i])
      } else {
        startDateFields[i].innerText = convertMsToHM(timeDiff);
      }
    }
  }
}, 1000)


function padTo2Digits(num) {
  return num.toString().padStart(2, '0');
}

function convertMsToHM(milliseconds) {
  let seconds = Math.floor(milliseconds / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);

  seconds = seconds % 60;
  minutes = minutes % 60;

  return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
}
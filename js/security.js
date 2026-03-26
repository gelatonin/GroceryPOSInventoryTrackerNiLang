// Prevent loading in an iframe
//clickjacking protection
if (window.top !== window.self) {
alert("Clickjacking detected!");
window.top.location =
window.location;
}
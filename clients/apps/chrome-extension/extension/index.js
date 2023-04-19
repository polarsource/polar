// function validate(redirectURL) {
//     alert(redirectURL);
// }

// function authorize() {
//     const redirectURL = chrome.identity.getRedirectURL();
//     const clientID = "Iv1.d4a7196f0694ccc8";
//     const scopes = ["user", "user:email"];
//     let authURL = "https://github.com/login/oauth/authorize";
//     authURL += `?client_id=${clientID}`;
//     authURL += `&response_type=token`;
//     authURL += `&redirect_uri=${encodeURIComponent(redirectURL)}`;
//     authURL += `&scope=${encodeURIComponent(scopes.join(' '))}`;

//     return chrome.identity.launchWebAuthFlow({
//         interactive: true,
//         url: authURL
//     });
// }

// function getAccessToken() {
//     return authorize().then(validate);
// }

function openInNewTab(event) {
    chrome.tabs.create({url: event.target.href})
}

window.addEventListener("load", function () {
    document.getElementById("button").addEventListener("click", openInNewTab);
});

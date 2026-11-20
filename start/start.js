const startForm = document.querySelector("#start-form");
const roadNavigationButton = document.querySelector("#show-road");

startForm.addEventListener("submit", (event) => {
    event.preventDefault();

    document.body.classList.add("game-started");
    roadNavigationButton.click();
});

// Timer
let timer;
let timerIsRunning = false;
let startTime;
let totalTime = 0;

const timerDisplay = document.getElementById('timerDisplay');
const startTimerButton = document.getElementById('startTimer');
const stopTimerButton = document.getElementById('stopTimer');
const resetTimerButton = document.getElementById('resetTimer');

startTimerButton.addEventListener('click', () => {
    if (!timerIsRunning) {
        startTime = Date.now() - totalTime;
        timer = setInterval(updateTimer, 1000);
        timerIsRunning = true;
    }
});

stopTimerButton.addEventListener('click', () => {
    if (timerIsRunning) {
        clearInterval(timer);
        timerIsRunning = false;
    }
});

resetTimerButton.addEventListener('click', () => {
    clearInterval(timer);
    timerIsRunning = false;
    totalTime = 0;
    updateTimerDisplay();
});

function updateTimer() {
    totalTime = Date.now() - startTime;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const seconds = Math.floor((totalTime / 1000) % 60);
    const minutes = Math.floor((totalTime / 1000 / 60) % 60);
    const hours = Math.floor(totalTime / 1000 / 3600);
    timerDisplay.textContent = `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Student Feedback
const studentList = document.querySelector('.student-list');
const studentNameInput = document.getElementById('studentName');
const studentTimeInput = document.getElementById('studentTime');
const addStudentButton = document.getElementById('addStudent');
const milestoneAlert = document.getElementById('milestoneAlert');

addStudentButton.addEventListener('click', () => {
    const studentName = studentNameInput.value.trim();
    const studentTime = parseInt(studentTimeInput.value);

    if (studentName !== '' && !isNaN(studentTime) && studentTime > 0) {
        const studentElement = document.createElement('div');
        studentElement.classList.add('student');
        studentElement.innerHTML = `
            <p>${studentName}:</p>
            <p>${studentTime} min</p>
        `;
        studentList.appendChild(studentElement);

        studentNameInput.value = '';
        studentTimeInput.value = '';

        // Calculate total time spent on students
        totalTime += studentTime * 60000; // Convert minutes to milliseconds
        updateTimerDisplay();

        // Check milestone completion
        if (totalTime >= 0.5 * 60 * 60 * 1000) { // 50% milestone (0.5 hours)
            milestoneAlert.textContent = 'Reached';
            milestoneAlert.style.color = 'green';
        }
    }
});

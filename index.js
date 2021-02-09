const backendURL = 'http://localhost:9000' ;

const socket = io(backendURL);
let socketId;

const chatForm = document.querySelector('#chat-form');
const messages = document.querySelector('#messages');

chatForm.addEventListener('submit', event => {
  event.preventDefault();

  const chatFormData = new FormData(event.target);
  const chatMessage = chatFormData.get('message');

  if (chatMessage) {
    socket.emit('chat message', chatMessage);
    displayMessage(chatMessage, true);
    event.target.reset();
  }
});

socket.on('connect', () => socketId = socket.id);

socket.on('message', message => {
  displayMessage(message, false);
});

function displayMessage(message, isSender) {
  const messageDisplay = document.createElement('li');
  isSender
    ? messageDisplay.classList.add('sender')
    : messageDisplay.classList.add('receiver');
  messageDisplay.textContent = message;
  messages.append(messageDisplay);
  window.scrollTo(0, document.body.scrollHeight);
}
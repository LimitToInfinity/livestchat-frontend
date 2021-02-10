const backendURL = 'https://livestchat.herokuapp.com/';
// const backendURL = 'http://localhost:9000';

const socket = io(backendURL);
let socketId;

const title = document.querySelector('#title');
const exit = document.querySelector('#exit');
const chatForm = document.querySelector('#chat-form');
const chatSubmit = document.querySelector('#chat-submit');
const rooms = document.querySelector('#rooms');
const messages = document.querySelector('#messages');

rooms.addEventListener('click', event => {
  const { classList, textContent } = event.target;

  if (classList.contains('room-selector')) {
    console.log(textContent);
    socket.emit('join room', textContent);
  }

  rooms.classList.add('hidden');
  chatSubmit.disabled = false;
  chatForm.dataset.room = textContent;
  title.textContent = textContent;
  messages.classList.remove('hidden');
  exit.classList.remove('hidden');
});

exit.addEventListener('click', () => {
  socket.emit('leave room', chatForm.dataset.room);
  rooms.classList.remove('hidden');
  chatSubmit.disabled = true;
  chatForm.dataset.room = '';
  title.textContent = 'Choose room';
  messages.innerHTML = ''
  messages.classList.add('hidden');
  exit.classList.add('hidden');
})

chatForm.addEventListener('submit', event => {
  console.log('submit');
  event.preventDefault();

  const { dataset: { room } } = event.target;

  const chatFormData = new FormData(event.target);
  const chatMessage = chatFormData.get('message');

  if (chatMessage) {
    socket.emit('room message', room, chatMessage);
    displayMessage(chatMessage, true);
    event.target.reset();
  }
});

socket.on('connect', () => socketId = socket.id);

socket.on('room message', message => {
  console.log('room');
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
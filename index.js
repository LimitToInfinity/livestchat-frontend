const backendURL = 'https://livestchat.herokuapp.com/';
// const backendURL = 'http://localhost:9000';

let socket;
let socketId;

const modal = document.querySelector('#modal');
const enterChat = document.querySelector('#enter-chat');
const title = document.querySelector('#title');
const exit = document.querySelector('#exit');
const chatForm = document.querySelector('#chat-form');
const chatSubmit = document.querySelector('#chat-submit');
const rooms = document.querySelector('#rooms');
const chatters = document.querySelector('#chatters');
const messages = document.querySelector('#messages');

enterChat.addEventListener('submit', event => {
  event.preventDefault();

  modal.classList.add('hidden');
  const enterChatFormData = new FormData(event.target);
  const username = enterChatFormData.get('username');

  socket = io(backendURL, { query: `name=${username}` });
  socket.on('connect', () => socketId = socket.id);
  socket.on('room message', message => {
    console.log('room');
    displayMessage(message, false);
  });
})

rooms.addEventListener('click', event => {
  const { classList, textContent } = event.target;

  if (classList.contains('room-selector')) {
    console.log(textContent);
    socket.emit('join room', textContent, people => {
      chatters.classList.remove('hidden');
      people.forEach(person => {
        const personDisplay = document.createElement('li');
        const personButton = document.createElement('button');
        personButton.classList.add('chatter');
        personButton.textContent = person;
        personDisplay.append(personButton);
        chatters.append(personDisplay);
      })
    });
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
  chatters.innerHTML = '';
  chatters.classList.add('hidden');
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

function displayMessage(message, isSender) {
  const messageDisplay = document.createElement('li');
  isSender
    ? messageDisplay.classList.add('sender')
    : messageDisplay.classList.add('receiver');
  messageDisplay.textContent = message;
  messages.append(messageDisplay);
  window.scrollTo(0, document.body.scrollHeight);
}
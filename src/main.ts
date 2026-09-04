import './styles.css';
import { App } from './app';

const root = document.getElementById('app');

if (root) {
  try {
    new App(root);
  } catch (error) {
    // A blank page tells the player nothing. Say what happened and how to get
    // back, and keep the failure in the console for whoever is looking.
    console.error(error);
    root.innerHTML =
      '<div class="enter"><main class="stage"><h1 class="ask sm">This did not load.</h1>' +
      '<p class="sub">Reloading usually fixes it. If it does not, the game needs a browser from 2022 or later.</p></main></div>';
  }
}

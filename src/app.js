import './styles/vme.css';
import { VME } from './VME.js';
import { ensureUiFont } from './ui/UiFont.js';

void ensureUiFont();
document.addEventListener("DOMContentLoaded", new VME());




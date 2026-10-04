import { closeModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { isAuthenticated, login, logout } from '../../services/authService';
import { onClick } from '../../utils/actions';
import { $ } from '../../utils/dom';

const FORM = `<form class="login-card" id="loginForm" novalidate>
  <div class="brand login-brand">RB <i>PROJECTS</i></div>
  <p class="sub login-sub">Entre para acessar seus projetos.</p>
  <label class="login-f">Nome<input class="field" id="loginName" autocomplete="username" autocapitalize="words"></label>
  <label class="login-f">Senha<input class="field" id="loginPass" type="password" autocomplete="current-password"></label>
  <p class="login-err" id="loginErr" role="alert"></p>
  <button class="primary login-btn">Entrar</button>
</form>`;

export function isLoginVisible(): boolean {
  return !$('#login').hidden;
}

function showLogin(): void {
  const form = $<HTMLFormElement>('#loginForm');
  form.reset();
  $('#loginErr').textContent = '';
  $('#login').hidden = false;
  $('#loginName').focus();
}

function submit(e: SubmitEvent): void {
  e.preventDefault();
  const name = $<HTMLInputElement>('#loginName');
  const pass = $<HTMLInputElement>('#loginPass');
  const result = login(name.value, pass.value);
  if (!result.ok) {
    $('#loginErr').textContent = result.message;
    if (result.field === 'name') name.focus();
    else pass.select();
    return;
  }
  $('#login').hidden = true;
  showToast('Login realizado.');
}

export function initLogin(): void {
  const root = $('#login');
  root.innerHTML = FORM;
  $<HTMLFormElement>('#loginForm').addEventListener('submit', submit);
  onClick('logout', () => {
    logout();
    closeModal();
    showLogin();
  });
  if (!isAuthenticated()) showLogin();
}

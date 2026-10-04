import { refresh } from '../../app/navigation';
import { icon } from '../../components/icons';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { getMyName, setMyName } from '../../services/userService';
import { onClick } from '../../utils/actions';
import { esc } from '../../utils/dom';

export function openSettings(): void {
  openModal(
    'Configurações',
    `<form id="setForm"><div class="form-full"><label>Seu nome<input class="field" name="me" list="usersList" value="${esc(
      getMyName(),
    )}"></label></div><p class="sub small">Usado em comentários, na atividade e no filtro "Minhas".</p><div class="modal-actions"><span></span><button class="primary">Salvar</button></div></form>`,
  );
  modalField<HTMLFormElement>('#setForm').addEventListener('submit', (e) => {
    e.preventDefault();
    setMyName(String(new FormData(e.currentTarget as HTMLFormElement).get('me') ?? ''));
    closeModal();
    refresh();
    showToast('Configurações salvas');
  });
}

/** Menu "Mais" do celular: itens que não cabem na barra inferior. */
function openMore(): void {
  openModal(
    'Mais',
    `<div class="more-list"><button class="ghost" data-action="nav" data-page="archive">${icon('archive')}Arquivados</button><button class="ghost" data-action="nav" data-page="users">${icon(
      'users',
    )}Usuários</button><button class="ghost" data-action="settings">${icon('settings')}Configurações</button><button class="ghost" data-action="logout">${icon('logout')}Sair</button></div>`,
  );
}

export function initSettings(): void {
  onClick('settings', openSettings);
  onClick('more', openMore);
}

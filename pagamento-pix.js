'use strict';
{
  const el = id => document.getElementById('adesao-pix' + (id ? '-' + id : ''));
  const status = el('status');
  const gerar = el('gerar');
  const codigo = el('codigo');
  const copia = el('copia');
  let estado, ocupado, timer;

  async function carregar(emitir = false) {
    if (ocupado) return;
    ocupado = true;
    gerar.disabled = true;
    try {
      const url = '/api/me/pix' + (!emitir && !copia.value ? '?qr=1' : '');
      const response = await fetch(url, emitir ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CADMIV': '1' },
        body: JSON.stringify({ centavos: estado.centavos })
      } : {});
      const dados = await response.json();
      if (!response.ok) throw Error(dados.erro || 'Não foi possível consultar o Pix.');
      const anterior = estado?.status;
      estado = dados;
      el().hidden = !dados.disponivel;
      if (!dados.disponivel) {
        clearInterval(timer);
        return;
      }
      const valor = (dados.centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const mensagens = {
        DISPONIVEL: valor,
        AGUARDANDO: 'Aguardando pagamento de ' + valor + '.',
        PAGO: 'Pagamento de ' + valor + ' confirmado.',
        EXPIRADO: 'Cobrança expirada. Entre em contato com o CADMIV.'
      };
      status.textContent = (dados.simulado ? 'Homologação (teste). ' : '') + mensagens[dados.status];
      gerar.hidden = dados.status !== 'DISPONIVEL';
      codigo.hidden = dados.status !== 'AGUARDANDO' || dados.simulado;
      if (dados.copia_cola && !dados.simulado) {
        copia.value = dados.copia_cola;
        el('imagem').src = dados.imagem;
      }
      if (dados.status === 'PAGO') {
        clearInterval(timer);
        if (anterior && anterior !== 'PAGO') location.reload();
      }
    } catch (e) {
      el().hidden = false;
      status.textContent = e.message;
      if (emitir && estado) {
        ocupado = false;
        await carregar();
        status.textContent = e.message + ' Confira o valor e tente novamente.';
      }
    } finally {
      ocupado = false;
      gerar.disabled = false;
    }
  }

  gerar.addEventListener('click', () => carregar(true));
  el('copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copia.value);
      status.textContent = 'Código Pix copiado.';
    } catch {
      copia.select();
      status.textContent = 'Selecione e copie o código Pix.';
    }
  });
  timer = setInterval(() => { if (!document.hidden) void carregar(); }, 20000);
  void carregar();
}

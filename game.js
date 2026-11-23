// game.js — Lugar Comum Bar
// Easter egg escondido: só carrega quando alguém abre o jogo digitando o código secreto (comanda 1337, nome GAME).
// Extraído do index.html pra deixar o site principal mais leve (esse arquivo tem ~1350 linhas que quase ninguém usa).
// Depende de variáveis/funções já globais do index.html: jogo, estado, renderizar, document, window, etc.

        function iniciarGame() {
            if (jogo) return;
            var el = document.createElement('div');
            el.id = 'janela-game';
            el.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; width:100%; height:100%; z-index:100; background:rgba(0,0,0,0.18); -webkit-user-select:none; user-select:none; touch-action:none;';
            var cv = document.createElement('canvas');
            cv.style.cssText = 'display:block; width:100%; height:100%;';
            el.appendChild(cv);
            document.body.appendChild(el);
            var W = el.clientWidth || window.innerWidth, H = el.clientHeight || window.innerHeight;
            cv.width = W; cv.height = H;
            var g = cv.getContext('2d');
            // altura do personagem = altura do botão "Venda rápida"
            var altura = 40, bts = document.getElementsByTagName('button'), b;
            for (b = 0; b < bts.length; b++) { if (String(bts[b].getAttribute('onclick') || '').indexOf('vendaRapida') >= 0 && bts[b].offsetHeight) { altura = bts[b].offsetHeight; break; } }
            var bc = document.getElementById('btn-aba-caixa'), S = (bc && bc.offsetWidth) ? bc.offsetWidth : 150;   // ferramentas: tamanho da caixa amarela "Caixa / Mesas"
            var ic = document.getElementById('icone-foice'), icR = ic ? ic.getBoundingClientRect() : { left: 20, top: 10, width: 24, height: 24 };
            var icX = icR.left + icR.width / 2, icY = icR.top + icR.height / 2, icS = Math.max(16, icR.height);
            var p = altura / 19;                       // 1 "pixel" do boneco
            var BW = 10 * p, BH = 19 * p;              // caixa do corpo (largura, altura)
            var GRAV = altura * 0.03, VEL = Math.max(1.4, altura * 0.049);   // velocidade geral (30% mais lenta)
            function velPulo(alt) { return Math.sqrt(2 * GRAV * alt); }
            var obst = [], quadro = 0;
            var segs = [], lay = document.createElement('canvas');   // desenhos do jogador (rampas, escadas...) viram chão
            lay.width = W; lay.height = H;
            var lg = lay.getContext('2d');
            lg.lineCap = 'round';
            function riscar(x1, y1, x2, y2) {
                lg.strokeStyle = '#000'; lg.lineWidth = 9; lg.beginPath(); lg.moveTo(x1, y1); lg.lineTo(x2, y2); lg.stroke();
                lg.strokeStyle = '#facc15'; lg.lineWidth = 5; lg.beginPath(); lg.moveTo(x1, y1); lg.lineTo(x2, y2); lg.stroke();
            }
            function redesenharCamada() {
                lg.clearRect(0, 0, W, H);
                for (var q = 0; q < segs.length; q++) riscar(segs[q].x1, segs[q].y1, segs[q].x2, segs[q].y2);
            }
            // superfície de desenho sob x, entre (yRef - acima) e (yRef + abaixo); devolve o y do topo do traço ou null
            function superficie(x, yRef, acima, abaixo) {
                var best = null, bd = 1e9, q, sg, lo, hi, t, sy, d;
                for (q = 0; q < segs.length; q++) {
                    sg = segs[q]; lo = sg.x1 < sg.x2 ? sg.x1 : sg.x2; hi = sg.x1 < sg.x2 ? sg.x2 : sg.x1;
                    if (x < lo || x > hi || sg.x1 === sg.x2) continue;
                    t = (x - sg.x1) / (sg.x2 - sg.x1); sy = sg.y1 + (sg.y2 - sg.y1) * t - 3;
                    d = sy - yRef;
                    if (d >= -acima && d <= abaixo && Math.abs(d) < bd) { bd = Math.abs(d); best = sy; }
                }
                return best;
            }
            function cruza(ax, ay, bx, by, cx, cy, dx, dy) { // segmento AB cruza CD?
                var d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy, den = d1x * d2y - d1y * d2x;
                if (den === 0) return false;
                var t = ((cx - ax) * d2y - (cy - ay) * d2x) / den, u = ((cx - ax) * d1y - (cy - ay) * d1x) / den;
                return t >= 0 && t <= 1 && u >= 0 && u <= 1;
            }
            // parede desenhada entre a posição antiga e a nova? (sondas na altura do peito/cabeça; rampas suaves não contam)
            function paredeDesenho(xAnt, h) {
                if (!segs.length) return false;
                var dir = h.x >= xAnt ? 1 : -1, e0 = xAnt + dir * BW / 2, e1 = h.x + dir * (BW / 2 + 3), q, k, sg, py;
                var alt = [BH * 0.5, BH * 0.75, BH * 0.95];
                for (k = 0; k < alt.length; k++) {
                    py = h.y - alt[k];
                    for (q = 0; q < segs.length; q++) { sg = segs[q]; if (cruza(e0, py, e1, py, sg.x1, sg.y1, sg.x2, sg.y2)) return true; }
                }
                return false;
            }
            function pousarNoDesenho(h, yAnt) { // caindo: pousa em cima de um traço
                if (h.vy < 0 || !segs.length) return;
                var sy = superficie(h.x, yAnt, 2, (h.y - yAnt) + 2);
                if (sy !== null) { h.y = sy; h.vy = 0; h.solo = true; }
            }
            function lerObstaculos() {
                var lista = document.querySelectorAll('button, .mesa-card, .btn-tab, input, select, h2, h3'), out = [], k, r;
                for (k = 0; k < lista.length; k++) {
                    if (el.contains(lista[k])) continue;
                    r = lista[k].getBoundingClientRect();
                    if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
                    out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
                }
                obstUI = out;
            }
            // (os blocos de madeira que caiam a cada morte foram removidos a pedido)
            var obstUI = [];
            function montarObst() { obst = obstUI.slice(); } // obstáculos = só os elementos da página
            function passoBlocos() { montarObst(); }
            lerObstaculos(); montarObst();
            var j = { raf: 0, cabecas: 0, toques: [], fim: false, el: el, hs: [], t0: Date.now(), ic: ic, heroiLib: true, heroiQuando: Date.now() + 6000 };   // o herói voador surge 1 s depois do último personagem (4º em 5 s)
            jogo = j;
            j.getObst = function() { return obst; }; j.bate = bate;
            function novo(tipo) {
                tipo = tipo || 0;
                var cores = ['#009c3b', '#2b2f3a', '#1d3f9e', '#222', '#7a5a3a'];   // 0 jogador verde/amarelo, 1 político, 2 Tio Sam, 3 revolucionário, 4 senhor grisalho (morre só para a ema)
                return { x: 20 + Math.random() * (W - 40), y: 0, vx: VEL * (tipo === 1 ? 1.3 : 1) * (Math.random() < 0.5 ? -1 : 1), vy: 0, solo: false, andar: 0, dir: 1, estado: 'vivo', t: 0, cab: null, sang: [], cor: cores[tipo], tipo: tipo, pulo: tipo === 2 ? 0.03 : (tipo === 1 ? 0.02 : 0.012), briga: 0, cd: 0, fase: 0, ft: 0, acabou: false, morte: '', mortes: 0, tomba: 0, forma: 'humano', estagio: 0, jc: 0, gc: 0, rasteja: false, oculto: false };
            }
            function nasceNaComanda(h) { // os bonecos surgem de dentro da janela "+ Nova comanda" e caem dali
                var bt = document.querySelector('button[onclick="novaComanda()"]'), r, k, tent;
                h.vy = 0; h.solo = false;
                if (bt) {
                    r = bt.getBoundingClientRect();
                    if (r.width > 8 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W) {
                        for (tent = 0; tent < 12; tent++) {
                            h.x = Math.max(BW, Math.min(W - BW, r.left + r.width * (0.2 + Math.random() * 0.6)));
                            h.y = Math.min(H, r.bottom + BH + 2);
                            for (k = 0; k < 30 && bate(h.x, h.y) && h.y < H; k++) h.y += BH * 0.3;
                            if (!bate(h.x, h.y)) return;
                        }
                        return;
                    }
                }
                h.y = 0;
            }
            function bate(x, y) { // caixa do corpo com pés em (x,y) bate em algum ícone?
                var l = x - BW / 2, r = x + BW / 2, t = y - BH, bo = y, k, o;
                for (k = 0; k < obst.length; k++) { o = obst[k]; if (r > o.l && l < o.r && bo > o.t && t < o.b) return o; }
                return null;
            }
            function cairParado(h) { // enquanto briga (parado no lugar) ainda obedece a gravidade: se o bloco sair de baixo, cai
                var yAnt = h.y, o;
                h.vy += GRAV; h.y += h.vy; h.solo = false;
                o = bate(h.x, h.y);
                if (o) { if (h.vy >= 0) { h.y = o.t; h.vy = 0; h.solo = true; } else { h.y = yAnt; h.vy = 0; } }
                else pousarNoDesenho(h, yAnt);
                if (h.y >= H) { h.y = H; h.vy = 0; h.solo = true; }
            }
            function noChao(o) { return o.y >= H - 3; }
            function todosNoChao(par) { var q; for (q = 0; q < par.length; q++) if (j.hs.indexOf(par[q]) >= 0 && !noChao(par[q])) return false; return true; }
            function mover(h) {
                var o;
                // horizontal
                var xAnt = h.x;
                h.x += h.vx;
                if (paredeDesenho(xAnt, h)) { // bateu numa parede desenhada: pula se for baixa, senão volta
                    var topo = superficie(h.x + (h.vx > 0 ? BW / 2 + 2 : -BW / 2 - 2), h.y, BH * 3.2, 0);
                    h.x = xAnt;
                    if (h.solo && topo !== null && !h.rasteja) h.vy = -velPulo((h.y - topo) + BH * 0.9);
                    else h.vx = -h.vx;
                }
                if (h.x < BW / 2) { h.x = BW / 2; h.vx = Math.abs(h.vx); }
                if (h.x > W - BW / 2) { h.x = W - BW / 2; h.vx = -Math.abs(h.vx); }
                if (h.solo && segs.length) { // sobe e desce rampas desenhadas; se for íngreme demais, pula ou volta
                    var sy0 = superficie(h.x, h.y, BH * 0.9, BH * 0.6);
                    if (sy0 !== null) {
                        if (sy0 < h.y - VEL * 1.4) {
                            var deg2 = h.y - sy0;
                            if (deg2 < BH * 3.2 && !h.rasteja) h.vy = -velPulo(deg2 + BH * 0.9); else { h.x -= h.vx; h.vx = -h.vx; }
                        } else h.y = sy0;
                    }
                }
                o = bate(h.x, h.y);
                if (o) {
                    var degrau = h.y - o.t; // quanto o obstáculo é mais alto que os pés
                    if (h.solo && degrau < BH * 3.2 && !h.rasteja) { h.vy = -velPulo(degrau + BH * 0.9); h.x = xAnt; }   // pula por cima (espera encostado enquanto sobe)
                    else if (!h.solo && h.vy < 0 && degrau < BH * 3.2 && !h.rasteja) h.x = xAnt;
                    else { h.x = h.vx > 0 ? o.l - BW / 2 - 0.5 : o.r + BW / 2 + 0.5; h.vx = -h.vx; }
                    if (bate(h.x, h.y) && !h.solo) h.x -= h.vx;
                }
                if (h.vx !== 0) h.dir = h.vx > 0 ? 1 : -1;
                // vertical
                var yAnt = h.y;
                h.vy += GRAV; h.y += h.vy; h.solo = false;
                o = bate(h.x, h.y);
                if (o) {
                    if (h.vy >= 0) { h.y = o.t; h.vy = 0; h.solo = true; }
                    else { h.y = o.b + BH + 0.5; h.vy = 0; }
                } else pousarNoDesenho(h, yAnt);
                if (h.y >= H) { h.y = H; h.vy = 0; h.solo = true; }
                if (h.solo) {
                    h.andar++;
                    if (Math.random() < h.pulo) h.vy = -velPulo(altura * (1.2 + Math.random() * 3.2)); // pulinho ou pulo alto
                    if (Math.random() < 0.004) h.vx = -h.vx;
                }
            }
            function cabeca(x, y, dir, t) { // (x,y) = centro do topo da cabeça
                t = t || 0;
                var cabelo = t === 1 ? '#a8adb3' : (t === 2 ? '#f2f2f2' : (t === 3 ? '#555' : '#5a3a1a'));
                g.fillStyle = '#f0c8a0'; g.fillRect(x - 3 * p, y, 6 * p, 6 * p);
                if (t === 4) { // senhor grisalho: calvo no topo, tufos nas laterais, bigode branco e óculos redondos
                    g.fillStyle = '#8a5a2e'; g.fillRect(x - 3 * p, y - p, 6 * p, 2 * p); g.fillRect(x - 4 * p, y, p, 4 * p); g.fillRect(x + 3 * p, y, p, 4 * p); g.fillRect(x - 3 * p, y + p, p, 2 * p); g.fillRect(x + 2 * p, y + p, p, 2 * p);
                    g.fillStyle = '#000'; g.fillRect(x + (dir > 0 ? 0 : -2) * p, y + 2 * p, p, p); g.fillRect(x + (dir > 0 ? 2 : 0) * p, y + 2 * p, p, p);
                    g.strokeStyle = '#222'; g.lineWidth = Math.max(1, p * 0.4);
                    g.beginPath(); g.arc(x + (dir > 0 ? 0.5 : -1.5) * p, y + 2.5 * p, 1.3 * p, 0, 6.2832, false); g.stroke();
                    g.beginPath(); g.arc(x + (dir > 0 ? 2.5 : 0.5) * p, y + 2.5 * p, 1.3 * p, 0, 6.2832, false); g.stroke();
                    g.fillStyle = '#fff'; g.fillRect(x - 2 * p, y + 4 * p, 4 * p, p * 1.1);
                    return;
                }
                g.fillStyle = cabelo; g.fillRect(x - 3 * p, y - p, 6 * p, 2 * p); g.fillRect(x - 3 * p, y, p, 3 * p);
                if (t === 3) g.fillRect(x - 4 * p, y - 2 * p, 8 * p, 3 * p);
                g.fillStyle = '#000'; g.fillRect(x + (dir > 0 ? 0 : -2) * p, y + 2 * p, p, p); g.fillRect(x + (dir > 0 ? 2 : 0) * p, y + 2 * p, p, p);
                if (t === 1) { g.fillStyle = '#000'; g.fillRect(x - 3 * p, y + 1.5 * p, 6 * p, p * 0.4); } // óculos
                if (t === 2 || t === 3) { g.fillStyle = t === 2 ? '#f2f2f2' : '#444'; g.fillRect(x - 3 * p, y + 4 * p, 6 * p, 3 * p); g.fillRect(x - 3 * p, y + 3 * p, p, 2 * p); g.fillRect(x + 2 * p, y + 3 * p, p, 2 * p); }
                if (t === 2) { // cartola azul com faixa vermelha e estrela
                    g.fillStyle = '#1d3f9e'; g.fillRect(x - 2 * p, y - 6 * p, 4 * p, 5 * p); g.fillRect(x - 4 * p, y - p, 8 * p, p);
                    g.fillStyle = '#e0262d'; g.fillRect(x - 2 * p, y - 3 * p, 4 * p, p);
                    g.fillStyle = '#fff'; g.fillRect(x - p * 0.5, y - 5 * p, p, p);
                }
            }
            function humano(h) {
                if (h.oculto) return;
                g.save();
                if (h.briga > 0) g.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3);
                if (h.crush) { g.translate(h.x, h.y); g.scale(1.7, 0.16); g.translate(-h.x, -h.y); }
                if (h.tomba > 0) { g.translate(h.x, h.y); g.rotate(h.tomba * (h.sdir || 1)); g.translate(-h.x, -h.y); }
                if (h.forma === 'jacare') jacareDes(h); else if (h.forma === 'boi') boiDes(h); else humano2(h);
                g.restore();
            }
            function humano2(h) {
                var t = h.tipo || 0;
                var x = Math.round(h.x), y = Math.round(h.y) - 9 * p; // y = centro do corpo (pés em h.y)
                var perna = ((h.estado === 'vivo' || h.rev) && h.solo) ? ((Math.floor(h.andar / 5) % 2) ? 1 : -1) : 0;
                var calca = t === 0 ? '#ffdf00' : (t === 1 ? '#333' : (t === 2 ? '#e0262d' : (t === 4 ? '#5a4430' : '#111')));
                var braco = t === 0 ? '#ffdf00' : h.cor;
                g.fillStyle = calca;
                g.fillRect(x - 3 * p, y + 4 * p + (perna > 0 ? 0 : p), 2 * p, 5 * p - (perna > 0 ? 0 : p));
                g.fillRect(x + p, y + 4 * p + (perna > 0 ? p : 0), 2 * p, 5 * p - (perna > 0 ? p : 0));
                if (t === 2) { g.fillStyle = '#fff'; g.fillRect(x - 3 * p, y + 6 * p, 2 * p, p); g.fillRect(x + p, y + 6 * p, 2 * p, p); }
                g.fillStyle = h.cor; g.fillRect(x - 4 * p, y - 3 * p, 8 * p, 7 * p);
                if (t === 0) { g.fillStyle = '#ffdf00'; g.fillRect(x - 4 * p, y + p, 8 * p, p); }
                else if (t === 1) { g.fillStyle = '#fff'; g.fillRect(x - p, y - 3 * p, 2 * p, 2 * p); g.fillStyle = '#e0262d'; g.fillRect(x - p * 0.5, y - 2 * p, p, 5 * p); }
                else if (t === 2) { g.fillStyle = '#fff'; g.fillRect(x - p, y - 3 * p, 2 * p, 3 * p); g.fillStyle = '#e0262d'; g.fillRect(x - p * 0.5, y - 3 * p, p, 3 * p); }
                else if (t === 4) { g.fillStyle = '#fff'; g.fillRect(x - p, y - 3 * p, 2 * p, 3 * p); g.fillStyle = '#e07b00'; g.fillRect(x - p * 0.5, y - 3 * p, p, 5 * p); }
                else { g.fillStyle = '#eee'; g.fillRect(x - p, y - 3 * p, 2 * p, 4 * p); }
                g.fillStyle = braco; g.fillRect(x - 6 * p, y - 3 * p + (perna > 0 ? p : 0), 2 * p, 5 * p); g.fillRect(x + 4 * p, y - 3 * p + (perna > 0 ? 0 : p), 2 * p, 5 * p);
                g.fillStyle = '#f0c8a0'; g.fillRect(x - 6 * p, y + 2 * p + (perna > 0 ? p : 0), 2 * p, p); g.fillRect(x + 4 * p, y + 2 * p + (perna > 0 ? 0 : p), 2 * p, p);
                if ((h.estado === 'vivo' || h.estado === 'parado' || h.comCabeca) && !h.semCabeca) cabeca(x, y - 9 * p, h.dir, t);
                if (t === 4 && h.estado === 'vivo') { // segura uma caixinha na mão da frente
                    var cx4 = x + h.dir * 7 * p, cy4 = y + 0.5 * p; g.fillStyle = '#c8923a'; g.fillRect(cx4 - 2 * p, cy4 - 2 * p, 4 * p, 3.5 * p); g.fillStyle = '#e8c070'; g.fillRect(cx4 - 2 * p, cy4 - 2 * p, 4 * p, p * 0.8); g.fillStyle = '#b3322a'; g.fillRect(cx4 - p * 0.4, cy4 - 2 * p, p * 0.8, 3.5 * p);
                }
                if (h.flechado) { // flecha cravada no peito
                    g.strokeStyle = '#7a5230'; g.lineWidth = Math.max(2, p * 0.7); g.beginPath(); g.moveTo(x - h.sdir * 8 * p, y - p); g.lineTo(x + h.sdir * 2 * p, y - p); g.stroke();
                    g.fillStyle = '#d4202a'; g.fillRect(x - h.sdir * 8 * p - p, y - 2 * p, 2 * p, 2 * p);
                }
                else { g.fillStyle = '#a00'; g.fillRect(x - 2 * p, y - 4 * p, 4 * p, p); }
            }
            function estrela(cx, cy, r) {
                var q, a, rr; g.beginPath();
                for (q = 0; q < 10; q++) { a = -Math.PI / 2 + q * Math.PI / 5; rr = q % 2 ? r * 0.4 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
                g.closePath(); g.fill();
            }
            function jacareDes(h) {
                var d = h.dir || 1, morto = (h.estado !== 'vivo' && h.estado !== 'parado'), perna = (Math.floor(h.andar / 6) % 2) ? 0.6 : -0.6;
                g.save(); g.translate(Math.round(h.x), Math.round(h.y)); if (d < 0) g.scale(-1, 1);
                if (morto) { g.translate(0, -5 * p); g.scale(1, -1); }
                g.fillStyle = '#1b5e20';
                g.fillRect(-4 * p, -1.6 * p + perna * p * 0.5, 1.6 * p, 1.6 * p); g.fillRect(0, -1.6 * p - perna * p * 0.5, 1.6 * p, 1.6 * p); g.fillRect(3 * p, -1.6 * p + perna * p * 0.5, 1.6 * p, 1.6 * p);
                g.beginPath(); g.moveTo(-6 * p, -3.8 * p); g.lineTo(-13 * p, -1.5 * p + perna * p); g.lineTo(-6 * p, -1.2 * p); g.closePath(); g.fill();   // rabo
                g.fillStyle = '#2e7d32'; g.fillRect(-6 * p, -4.2 * p, 11 * p, 3 * p);
                g.fillStyle = '#1b5e20'; g.fillRect(-5 * p, -5.2 * p, p, p); g.fillRect(-2.5 * p, -5.2 * p, p, p); g.fillRect(0, -5.2 * p, p, p); g.fillRect(2.5 * p, -5.2 * p, p, p);
                g.fillStyle = '#388e3c'; g.fillRect(5 * p, -3.8 * p, 6 * p, 2.2 * p);
                g.fillStyle = '#fff'; g.fillRect(6 * p, -1.7 * p, p * 0.8, p * 0.8); g.fillRect(8 * p, -1.7 * p, p * 0.8, p * 0.8); g.fillRect(10 * p, -1.7 * p, p * 0.8, p * 0.8);
                g.fillStyle = '#fff'; g.fillRect(5 * p, -5.2 * p, 1.8 * p, 1.8 * p); g.fillStyle = '#000'; g.fillRect(6 * p, -4.8 * p, p, p);
                g.restore();
            }
            function boiDes(h) {
                var d = h.dir || 1, morto = (h.estado !== 'vivo' && h.estado !== 'parado'), perna = (Math.floor(h.andar / 6) % 2) ? 0.7 : -0.7;
                g.save(); g.translate(Math.round(h.x), Math.round(h.y)); if (d < 0) g.scale(-1, 1);
                if (h.gSplatVisual) { g.translate(0, -1.5 * p); g.scale(1.55, 0.22); }   // espatifado no chão (caiu do disco voador)
                if (morto) { g.translate(0, -9 * p); g.scale(1, -1); }
                g.fillStyle = '#d9d9d9';
                g.fillRect(-5.5 * p, -3 * p + perna * p * 0.4, 1.6 * p, 3 * p); g.fillRect(-2.5 * p, -3 * p - perna * p * 0.4, 1.6 * p, 3 * p);
                g.fillRect(2 * p, -3 * p + perna * p * 0.4, 1.6 * p, 3 * p); g.fillRect(4.5 * p, -3 * p - perna * p * 0.4, 1.6 * p, 3 * p);
                g.fillStyle = '#f2f2f2'; g.fillRect(-6.5 * p, -8.5 * p, 13 * p, 5.8 * p);
                g.fillStyle = '#222'; g.fillRect(-4 * p, -8 * p, 3.2 * p, 2.4 * p); g.fillRect(1.5 * p, -6.5 * p, 3 * p, 2.4 * p);
                g.fillStyle = '#d9d9d9'; g.fillRect(-7.5 * p, -8.5 * p, p, 5 * p);
                g.fillStyle = '#f2f2f2'; g.fillRect(5.5 * p, -10 * p, 4.5 * p, 4.5 * p);
                g.fillStyle = '#f4a6b0'; g.fillRect(8.5 * p, -7.5 * p, 1.8 * p, 2.2 * p);
                g.fillStyle = '#fff'; g.fillRect(5.6 * p, -12 * p, p, 2.2 * p); g.fillRect(8 * p, -12 * p, p, 2.2 * p);
                g.fillStyle = '#000'; g.fillRect(7.2 * p, -9 * p, p * 0.8, p * 0.8);
                g.restore();
            }
            function seringa(x, y, ang, L, plung) {
                g.save(); g.translate(x, y); g.rotate(ang);
                var ll = L * 0.5 * (1 - plung);
                g.fillStyle = '#c9ced3'; g.fillRect(0, -L * 0.012, L * 0.32, L * 0.024);
                g.fillStyle = 'rgba(235,242,250,0.97)'; g.fillRect(-L * 0.52, -L * 0.09, L * 0.52, L * 0.18);
                g.fillStyle = '#39d353'; g.fillRect(-ll, -L * 0.075, ll, L * 0.15);
                g.strokeStyle = '#333'; g.lineWidth = 1; g.strokeRect(-L * 0.52, -L * 0.09, L * 0.52, L * 0.18);
                g.fillStyle = '#888'; g.fillRect(-L * 0.52 - L * 0.18 + plung * L * 0.5 * 0.9, -L * 0.012, L * 0.2, L * 0.024);
                g.fillRect(-L * 0.52 - L * 0.18 + plung * L * 0.5 * 0.9, -L * 0.07, L * 0.025, L * 0.14);
                g.restore();
            }
            function ovni(x, y, w) {
                g.fillStyle = 'rgba(150,225,255,0.95)'; g.beginPath(); g.arc(x, y - w * 0.04, w * 0.22, Math.PI, 0, false); g.fill();
                g.save(); g.translate(x, y); g.scale(1, 0.28); g.fillStyle = '#b9c0c8'; g.beginPath(); g.arc(0, 0, w * 0.5, 0, 6.2832, false); g.fill(); g.strokeStyle = '#555'; g.lineWidth = 2; g.stroke(); g.restore();
                var q; g.fillStyle = '#ffe44d'; for (q = -2; q <= 2; q++) { g.beginPath(); g.arc(x + q * w * 0.18, y + w * 0.02, w * 0.03, 0, 6.2832, false); g.fill(); }
            }
            function bandeiraCuba(x, y, w, hh) {
                var q, sh = hh / 5;
                for (q = 0; q < 5; q++) { g.fillStyle = q % 2 ? '#ffffff' : '#002a8f'; g.fillRect(x, y + q * sh, w, sh + 0.5); }
                g.fillStyle = '#cf142b'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * 0.45, y + hh / 2); g.lineTo(x, y + hh); g.closePath(); g.fill();
                g.fillStyle = '#fff'; estrela(x + w * 0.15, y + hh / 2, hh * 0.17);
                g.strokeStyle = '#333'; g.lineWidth = 1; g.strokeRect(x, y, w, hh);
            }
            function aviaoDes(x, y, ang, L) {
                g.save(); g.translate(x, y); g.rotate(ang); if (Math.cos(ang) < 0) g.scale(1, -1);
                g.fillStyle = '#ff8c00'; g.beginPath(); g.moveTo(-L * 0.5, 0); g.lineTo(-L * (0.75 + Math.random() * 0.2), 0); g.lineTo(-L * 0.5, -L * 0.07); g.closePath(); g.fill();
                g.fillStyle = '#eceff1'; g.fillRect(-L * 0.5, -L * 0.09, L, L * 0.18);
                g.beginPath(); g.moveTo(L * 0.5, -L * 0.09); g.lineTo(L * 0.66, 0); g.lineTo(L * 0.5, L * 0.09); g.closePath(); g.fill();
                g.fillStyle = '#2a6ad4'; g.fillRect(-L * 0.5, -L * 0.015, L, L * 0.04);
                g.fillStyle = '#b0bec5'; g.beginPath(); g.moveTo(-L * 0.05, L * 0.09); g.lineTo(-L * 0.3, L * 0.34); g.lineTo(L * 0.08, L * 0.34); g.lineTo(L * 0.18, L * 0.09); g.closePath(); g.fill();
                g.beginPath(); g.moveTo(-L * 0.5, -L * 0.09); g.lineTo(-L * 0.66, -L * 0.3); g.lineTo(-L * 0.38, -L * 0.09); g.closePath(); g.fill();
                g.fillStyle = '#4aa3df'; var q; for (q = 0; q < 5; q++) g.fillRect(L * (0.2 - q * 0.1), -L * 0.06, L * 0.05, L * 0.05);
                g.restore();
            }
            function foiceDes(x, y, R, ang) {
                g.save(); g.translate(x, y);
                g.strokeStyle = '#7a5230'; g.lineWidth = Math.max(3, R * 0.09); g.beginPath(); g.moveTo(Math.cos(ang - 0.9) * R * 1.5, Math.sin(ang - 0.9) * R * 1.5); g.lineTo(Math.cos(ang) * R * 0.2, Math.sin(ang) * R * 0.2); g.stroke();
                g.strokeStyle = '#dfe6ea'; g.lineWidth = Math.max(4, R * 0.12); g.beginPath(); g.arc(0, 0, R, ang - 0.7, ang + 0.15, false); g.stroke();
                g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(2, R * 0.05); g.beginPath(); g.arc(0, 0, R, ang - 1.4, ang - 0.7, false); g.stroke();
                g.restore();
            }
            function martelo(x, y, T, rot) { // cabo para cima, cabeça de ferro embaixo
                g.save(); g.translate(x, y); g.rotate(rot);
                g.fillStyle = '#7a5230'; g.fillRect(-T * 0.05, -T * 0.55, T * 0.1, T * 0.8);
                g.fillStyle = '#c9d1d6'; g.fillRect(-T * 0.3, T * 0.12, T * 0.6, T * 0.26);
                g.strokeStyle = '#333'; g.lineWidth = Math.max(2, T * 0.025); g.strokeRect(-T * 0.3, T * 0.12, T * 0.6, T * 0.26);
                g.restore();
            }
            function aplicarForma(h) {
                var sd = h.vx >= 0 ? 1 : -1;
                if (h.forma === 'jacare') { h.rasteja = true; h.pulo = 0; h.vx = sd * VEL * 0.45; }
                else if (h.forma === 'boi') { h.rasteja = true; h.pulo = 0; h.vx = sd * VEL * 0.7; }
                else { h.rasteja = false; h.pulo = h.tipo === 2 ? 0.03 : (h.tipo === 1 ? 0.02 : 0.012); h.vx = sd * VEL * (h.tipo === 1 ? 1.3 : 1); }
            }
            function cortar(h) {
                h.estado = 'corte'; h.t = 0; h.vx = 0;
                if (h.forma !== 'humano') { var kk; for (kk = 0; kk < 24; kk++) h.sang.push({ x: h.x, y: h.y - BH * 0.3, vx: (Math.random() - 0.5) * p * 1.6, vy: -Math.random() * p * 1.6, v: 40 + Math.random() * 30 }); j.cabecas++; return; }
                h.cab = { x: h.x, y: h.y - BH, vx: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2) * p / 3, vy: -velPulo(altura * 1.5), rot: 0 };
                var k; for (k = 0; k < 24; k++) h.sang.push({ x: h.x, y: h.y - BH * 0.8, vx: (Math.random() - 0.5) * p * 1.6, vy: -Math.random() * p * 1.6, v: 40 + Math.random() * 30 });
                j.cabecas++;
            }
            // depois do reinício: desenhos e a página inteira (menu, comandas...) caem para o fim da tela
            function cairPagina() {
                j.caiu = true; j.queda = [];
                var cand = document.querySelectorAll('h1, h2, h3, button, .mesa-card, .painel-lateral, .kds-card, .sync-status, main p'), arr = [], q, r, n, o, k;
                for (q = 0; q < cand.length; q++) {
                    if (el.contains(cand[q])) continue;
                    var dentro = false;
                    for (n = 0; n < cand.length; n++) { if (n !== q && cand[n].contains(cand[q])) { dentro = true; break; } }
                    if (dentro) continue;
                    r = cand[q].getBoundingClientRect();
                    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > H) continue;
                    arr.push({ el: cand[q], t: r.top, b: r.bottom, l: r.left, r: r.right });
                }
                arr.sort(function(a, b2) { return b2.b - a.b; });   // os de baixo caem primeiro e formam a pilha
                var pousados = [];
                for (q = 0; q < arr.length; q++) {
                    o = arr[q]; var chao = H - 2;
                    for (k = 0; k < pousados.length; k++) {
                        if (Math.min(o.r, pousados[k].r) - Math.max(o.l, pousados[k].l) > 4) chao = Math.min(chao, pousados[k].topo);
                    }
                    var dy = chao - o.b; if (dy < 0) dy = 0;
                    pousados.push({ l: o.l, r: o.r, topo: o.t + dy });
                    o.el.style.webkitTransformOrigin = o.el.style.transformOrigin = '50% 50%';
                    j.queda.push({ el: o.el, y: 0, vy: 0, alvo: dy, rot: (Math.random() - 0.5) * 7, espera: Math.floor(Math.random() * 70), pronto: false });
                }
                // desenhos: caem juntos até o chão
                var maxY = 0; for (q = 0; q < segs.length; q++) maxY = Math.max(maxY, segs[q].y1, segs[q].y2);
                j.desAlvo = segs.length ? Math.max(0, (H - 4) - maxY) : 0; j.desY = 0; j.desVy = 0;
            }
            function passoQueda() {
                var q, c, f;
                for (q = 0; q < j.queda.length; q++) {
                    c = j.queda[q]; if (c.pronto) continue;
                    if (c.espera > 0) { c.espera--; continue; }
                    c.vy += 0.9; c.y += c.vy;
                    if (c.y >= c.alvo) { c.y = c.alvo; c.pronto = true; }
                    f = c.alvo > 0 ? c.y / c.alvo : 1;
                    c.el.style.webkitTransform = c.el.style.transform = 'translate3d(0,' + Math.round(c.y) + 'px,0) rotate(' + (c.rot * f).toFixed(2) + 'deg)';
                }
                if (j.desAlvo > 0 && j.desY < j.desAlvo) {
                    j.desVy += 0.9; j.desY += j.desVy;
                    if (j.desY >= j.desAlvo) {
                        j.desY = j.desAlvo;
                        for (q = 0; q < segs.length; q++) { segs[q].y1 += j.desY; segs[q].y2 += j.desY; }
                        redesenharCamada(); j.desY = 0; j.desAlvo = 0;
                    }
                }
            }
            function reiniciar() { // todos já morreram: recomeça a sequência (1º agora, 2º em 1 s, 3º em 3 s)
                j.hs = []; j.t0 = Date.now(); j.nuvem = null; j.toques = []; j.emaR = null;
                if (ic) ic.style.visibility = 'visible';
            }
            function checarBriga(a, b) {
                if (a.cd > 0) a.cd--; if (b.cd > 0) b.cd--;
                if (a.cd > 0 || b.cd > 0) return;
                if (j.nuvem && j.nuvem.t > 0) return;   // só existe uma confusão por vez: quem passar por ela entra nela
                if (Math.abs(a.x - b.x) < BW * 1.3 && Math.abs(a.y - b.y) < BH * 0.8) {
                    a.briga = b.briga = 90; a.cd = b.cd = 300;
                    j.nuvem = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - BH / 2, t: 90, par: [a, b] };
                    var sd = a.x < b.x ? -1 : 1;   // depois da briga, cada um foge para um lado
                    a.vx = sd * VEL * 1.6; b.vx = -sd * VEL * 1.6;
                }
            }
            function juntarBriga() { // quem cruza com uma confusão entra nela; ela só acaba 1,5 s depois de o último entrar
                var n = j.nuvem, k, c, q, m, em = j.emaR, fugir;
                if (!n || n.t <= 0 || n.onca || j.pantera || !n.par) return;
                if (!n.raio && n.t > 1000) return;
                var cand = j.hs.slice(); if (em && n.par.indexOf(em) < 0 && em.pausa <= 0) cand.push(em);
                for (k = 0; k < cand.length; k++) {
                    c = cand[k];
                    if (n.par.indexOf(c) >= 0) continue;
                    if (c !== em && (c.estado !== 'vivo' || c.fase !== 0 || c.condenado || c.briga > 0)) continue;
                    if (Math.abs(c.x - n.x) < BW * 2.3 && Math.abs((c === em ? H : c.y) - (n.y + BH / 2)) < BH * 0.9) {
                        n.par.push(c); fugir = c.x < n.x ? -1 : 1;
                        if (c === em) { em.pausa = n.raio ? 99999 : 90; em.dir = fugir; } else { c.briga = n.raio ? 99999 : 90; c.cd = 300; c.vx = fugir * VEL * 1.5; c.x = n.x + fugir * BW * (0.4 + Math.random() * 0.9); }
                        if (!n.raio) {
                            n.t = 90;   // reinicia o tempo da confusão para todos
                            for (q = 0; q < n.par.length; q++) { m = n.par[q]; if (m === em) em.pausa = 90; else if (j.hs.indexOf(m) >= 0) m.briga = 90; }
                        }
                    }
                }
                if (!n.raio && n.par.length >= 3) { // 3 ou mais: o índio faz fumaça e chama os raios
                    n.raio = true; n.t = 99999; j.fumaca = { t: 0, puffs: [] };
                    for (q = 0; q < n.par.length; q++) { m = n.par[q]; if (m === em) em.pausa = 99999; else if (j.hs.indexOf(m) >= 0) m.briga = 99999; }
                }
            }
            function passoFumaca() {
                var fu = j.fumaca, n = j.nuvem, k, pf, q, m, agora = Date.now(), ok = n && n.raio && n.t > 0;
                if (!fu) return;
                if (!ok) { j.fumaca = null; return; }
                fu.t++;
                for (k = 0; k < 2; k++) fu.puffs.push({ x: indioPos.x + (Math.random() - 0.5) * 4 * p, y: indioPos.y - 14 * p, vx: (n.x > indioPos.x ? 1 : -1) * (0.2 + Math.random() * 0.4), vy: -0.5 - Math.random() * 0.5, r: 2 * p, a: 0.9 });
                g.fillStyle = 'rgba(20,20,30,' + (0.28 * Math.min(1, fu.t / 100)) + ')'; g.fillRect(0, 0, W, H);   // o céu escurece
                for (k = fu.puffs.length - 1; k >= 0; k--) {
                    pf = fu.puffs[k]; pf.x += pf.vx; pf.y += pf.vy; pf.r += 0.12 * p * 0.5; pf.a -= 0.008;
                    if (pf.a <= 0) { fu.puffs.splice(k, 1); continue; }
                    g.fillStyle = 'rgba(210,210,215,' + pf.a + ')'; g.beginPath(); g.arc(pf.x, pf.y, pf.r, 0, 6.2832, false); g.fill();
                }
                if (fu.t >= 130) { // caem os raios: todos os que brigam morrem (o senhor grisalho e a ema não)
                    for (q = 0; q < n.par.length; q++) {
                        m = n.par[q];
                        if (m === j.emaR) { m.pausa = 0; continue; }
                        if (j.hs.indexOf(m) < 0) continue;
                        m.condenado = false; m.briga = 0;
                        if (m.tipo === 4 || m.estado !== 'vivo') continue;
                        m.estado = 'parado'; m.vx = 0; m.fase = 1; m.ft = 0; m.morte = 'raio'; m.boom = true; m.tFim = agora; j.cabecas++;
                    }
                    n.t = 0; j.fumaca = null;
                }
            }
            function animarRaio(h, ft, agora) {
                var k, x = h.x, y0 = h.y - BH * 0.9, yy, xx, i;
                if (ft < 3) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, 0, W, H); }
                if (ft < 18) { // raio do céu até a cabeça
                    for (i = 0; i < 2; i++) {
                        g.strokeStyle = i ? '#fff' : '#ffe066'; g.lineWidth = i ? Math.max(1.5, p) : Math.max(3, p * 2.4); g.beginPath(); xx = x + (Math.random() - 0.5) * 6 * p; g.moveTo(xx, 0);
                        for (yy = 0; yy < y0; yy += 14 + Math.random() * 14) { xx = x + (Math.random() - 0.5) * 9 * p; g.lineTo(xx, yy); }
                        g.lineTo(x, y0); g.stroke();
                    }
                }
                if (ft === 6) {
                    h.estado = 'morto'; h.vx = 0;
                    for (k = 0; k < 24; k++) h.sang.push({ x: h.x, y: h.y - BH * 0.5, vx: (Math.random() - 0.5) * p * 4, vy: -Math.random() * p * 3, v: 30 + Math.random() * 25, c: k % 2 ? '#ffe066' : '#fff', s: Math.max(2, p) });
                }
                if (ft >= 6 && h.tomba < 1.5) h.tomba += 0.06;
                if (agora - h.tFim >= 2400) h.acabou = true;
            }
            function desenharBriga() {
                var n = j.nuvem, k, ang, r, gr = 1 + ((n.par ? n.par.length : 2) - 2) * 0.45;
                n.t--;
                for (k = 0; k < 7 + Math.round((gr - 1) * 6); k++) {
                    ang = Math.random() * 6.28; r = BW * gr * (0.5 + Math.random() * 0.9);
                    g.fillStyle = k % 2 ? '#e8e8e8' : '#9a9a9a';
                    g.beginPath(); g.arc(n.x + Math.cos(ang) * r, n.y + Math.sin(ang) * r * 0.7, p * (1.2 + Math.random() * 1.4), 0, 6.28); g.fill();
                }
                g.fillStyle = '#ffdf00'; g.fillRect(n.x - p, n.y - BH * 0.7 - (Math.random() * p), 2 * p, 2 * p);
                g.fillRect(n.x - BW * 0.9, n.y - BH * 0.4, 2 * p, 2 * p); g.fillRect(n.x + BW * 0.8, n.y - BH * 0.5, 2 * p, 2 * p);
            }
            function foguete(x, y, ang, L) {
                g.save(); g.translate(x, y); g.rotate(ang);
                g.fillStyle = '#ff8c00'; g.beginPath(); g.moveTo(-L * 0.5, 0); g.lineTo(-L * (0.8 + Math.random() * 0.25), 0); g.lineTo(-L * 0.5, -L * 0.11); g.lineTo(-L * 0.5, L * 0.11); g.closePath(); g.fill();
                g.fillStyle = '#e6e6e6'; g.fillRect(-L * 0.5, -L * 0.14, L * 0.8, L * 0.28);
                g.fillStyle = '#d4202a'; g.beginPath(); g.moveTo(L * 0.3, -L * 0.14); g.lineTo(L * 0.55, 0); g.lineTo(L * 0.3, L * 0.14); g.closePath(); g.fill();
                g.fillRect(-L * 0.5, -L * 0.28, L * 0.2, L * 0.14); g.fillRect(-L * 0.5, L * 0.14, L * 0.2, L * 0.14);
                g.fillStyle = '#4aa3df'; g.beginPath(); g.arc(L * 0.05, 0, L * 0.07, 0, 6.28); g.fill();
                g.restore();
            }
            // índio com arco e flecha: fica no topo, onde aparece "Clique em uma comanda ao lado para gerenciar"
            var indioPos = { x: W * 0.85, y: 90 };
            function lerIndio() {
                var pEl = document.querySelector('.painel-lateral p'), pl = document.querySelector('.painel-lateral'), r = pl ? pl.getBoundingClientRect() : null;
                if (r && r.width > 0) { indioPos.x = r.left + r.width / 2; indioPos.y = pl ? pl.getBoundingClientRect().top : r.top; }
                else { indioPos.x = W * 0.85; indioPos.y = 90; }
                indioPos.y = Math.max(26 * p, Math.min(H - 4, indioPos.y)); indioPos.x = Math.max(8 * p, Math.min(W - 8 * p, indioPos.x));
            }
            lerIndio();
            function desenharIndio(puxa, dir) {
                var x = Math.round(indioPos.x), y = Math.round(indioPos.y), cor = '#a8693a';
                g.fillStyle = cor; g.fillRect(x - 3 * p, y - 5 * p, 2 * p, 5 * p); g.fillRect(x + p, y - 5 * p, 2 * p, 5 * p);   // pernas
                g.fillStyle = '#b5322d'; g.fillRect(x - 3 * p, y - 8 * p, 6 * p, 3 * p);                                         // tanga
                g.fillStyle = cor; g.fillRect(x - 3 * p, y - 14 * p, 6 * p, 6 * p);                                              // tronco
                g.fillStyle = '#fff'; g.fillRect(x - 3 * p, y - 12 * p, 6 * p, p * 0.7);                                          // pintura
                g.fillRect(x - dir * 3 * p, y - 13 * p, p, 3 * p);
                g.fillStyle = cor; g.fillRect(x - 2.5 * p, y - 19 * p, 5 * p, 5 * p);                                           // cabeça
                g.fillStyle = '#111'; g.fillRect(x - 3 * p, y - 20 * p, 6 * p, 2 * p); g.fillRect(x - dir * 3 * p - (dir > 0 ? p : 0), y - 19 * p, p, 6 * p);   // cabelo
                g.fillStyle = '#d4202a'; g.fillRect(x - 3 * p, y - 17.5 * p, 6 * p, p);                                          // faixa
                g.fillStyle = '#fff'; g.fillRect(x - dir * 2 * p, y - 24 * p, p, 4 * p); g.fillStyle = '#d4202a'; g.fillRect(x - dir * 2 * p, y - 24 * p, p, p);   // pena
                g.fillStyle = '#000'; g.fillRect(x + dir * p - (dir > 0 ? 0 : p), y - 17 * p, p, p);
                var bx = x + dir * 6 * p, by = y - 12 * p;                                                                         // arco
                g.fillStyle = cor; g.fillRect(dir > 0 ? x : x - 6 * p, y - 12.5 * p, 6 * p, 1.5 * p);                             // braço da frente
                g.strokeStyle = '#7a5230'; g.lineWidth = Math.max(2, p * 0.9); g.beginPath();
                g.arc(bx - dir * 3 * p, by, 7 * p, dir > 0 ? -1.15 : Math.PI - 1.15, dir > 0 ? 1.15 : Math.PI + 1.15, false); g.stroke();
                var tx1 = bx - dir * 3 * p + Math.cos(dir > 0 ? -1.15 : Math.PI - 1.15) * 7 * p, ty1 = by + Math.sin(dir > 0 ? -1.15 : Math.PI - 1.15) * 7 * p, ty2 = by * 2 - ty1;
                var mx2 = bx - dir * (puxa * 7 * p);
                g.strokeStyle = '#eee'; g.lineWidth = 1; g.beginPath(); g.moveTo(tx1, ty1); g.lineTo(mx2, by); g.lineTo(tx1, ty2); g.stroke();
                if (puxa > 0 && puxa < 2) setaDes(mx2 + dir * 15 * p, by, dir > 0 ? 0 : Math.PI, 30 * p);
                if (puxa > 0) { g.fillStyle = cor; g.fillRect(Math.min(x, mx2), y - 12.5 * p, Math.abs(mx2 - x) + p, 1.5 * p); }
            }
            function setaDes(x, y, ang, L) { // flecha: haste, ponta de metal e penas; (x,y) = centro
                g.save(); g.translate(x, y); g.rotate(ang);
                g.strokeStyle = '#8b5a2b'; g.lineWidth = Math.max(3, p * 1.5); g.beginPath(); g.moveTo(-L * 0.5, 0); g.lineTo(L * 0.4, 0); g.stroke();
                g.fillStyle = '#cfd5da'; g.beginPath(); g.moveTo(L * 0.58, 0); g.lineTo(L * 0.36, -L * 0.1); g.lineTo(L * 0.36, L * 0.1); g.closePath(); g.fill();
                g.strokeStyle = '#333'; g.lineWidth = 1; g.stroke();
                g.fillStyle = '#d4202a'; g.beginPath(); g.moveTo(-L * 0.5, 0); g.lineTo(-L * 0.36, -L * 0.13); g.lineTo(-L * 0.24, -L * 0.13); g.lineTo(-L * 0.34, 0); g.closePath(); g.fill();
                g.beginPath(); g.moveTo(-L * 0.5, 0); g.lineTo(-L * 0.36, L * 0.13); g.lineTo(-L * 0.24, L * 0.13); g.lineTo(-L * 0.34, 0); g.closePath(); g.fill();
                g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-L * 0.34, 0); g.lineTo(-L * 0.24, -L * 0.13); g.lineTo(-L * 0.14, -L * 0.13); g.lineTo(-L * 0.22, 0); g.closePath(); g.fill();
                g.beginPath(); g.moveTo(-L * 0.34, 0); g.lineTo(-L * 0.24, L * 0.13); g.lineTo(-L * 0.14, L * 0.13); g.lineTo(-L * 0.22, 0); g.closePath(); g.fill();
                g.restore();
            }
            function animarFlecha(h) {
                var ft = h.ft++, agora = Date.now(), k;
                var pre = 26, voo = 42, LS = p * 30, AR = H * 0.05;
                var hx = indioPos.x + h.dirI * 6 * p, hy = indioPos.y - 12 * p, tx = h.x, ty = h.y - BH * 0.55;
                if (!h.dirI) h.dirI = tx >= indioPos.x ? 1 : -1;
                if (ft >= pre && !h.boom) {
                    var u = Math.min(1, (ft - pre) / voo), ax = hx + (tx - hx) * u, ay = hy + (ty - hy) * u - Math.sin(u * Math.PI) * AR;
                    setaDes(ax, ay, Math.atan2((ty - hy) - AR * Math.PI * Math.cos(u * Math.PI), tx - hx), LS);
                    if (u >= 1) {
                        h.boom = true; h.tFim = agora; j.cabecas++; h.estado = 'morto'; h.comCabeca = true; h.flechado = true; h.vx = 0;
                        h.sdir = tx >= hx ? 1 : -1;
                        for (k = 0; k < 18; k++) h.sang.push({ x: tx, y: ty, vx: (Math.random() - 0.5) * p * 2, vy: -Math.random() * p * 2, v: 40 + Math.random() * 30 });
                    }
                }
                if (h.boom) {
                    if (h.tomba < 1.5) h.tomba += 0.07;
                    if (agora - h.tFim >= 2500) h.acabou = true;
                }
            }
            // fase 2: foguete cruza a página e acerta o político; fase 3: o revolucionário baixa a guilhotina no Tio Sam
            function escolherMorte(h) {
                var m, lst;
                if (h.tipo === 4) return 'ema';   // o senhor grisalho só morre para a ema gigante
                if (h.tipo === 0) {
                    if (h.estagio === 0) m = 'ferramentas';
                    else if (h.estagio === 1) m = 'vacina';
                    else if (h.estagio === 2) m = ['foice', 'martelo', 'tiro'][h.jc % 3];
                    else if (h.estagio === 3) m = 'abducao';
                    else m = 'ferramentas';   // estágio 4: o patriota morre normal e reinicia o ciclo (vira humano de novo)
                } else if (h.tipo === 1) {
                    if (h.mortes === 0) m = 'foguete';
                    else { lst = ['foice', 'flecha', 'foguete', 'aviao', 'bandeira']; m = lst[(h.mortes - 1) % 5]; }
                } else {
                    if (h.mortes === 0) m = 'guilhotina';
                    else { lst = ['flecha', 'aviao', 'guilhotina']; m = lst[(h.mortes - 1) % 3]; }
                }
                if (m === 'guilhotina') { if (j.carr) m = 'aviao'; else j.carr = { reservado: true }; }   // o carrasco só aparece 1x por vez na tela
                return m;
            }
            function animarVacina(h, ft) {
                var tx = h.x, ty = h.y - BH * 0.55, sx0 = tx + S * 0.8, sy0 = -S * 0.3, u = Math.min(1, ft / 30), L = S * 0.6, k;
                var ex = tx + BW * 0.5, ang = Math.atan2(ty - sy0, ex - sx0);
                if (ft < 52) seringa(sx0 + (ex - sx0) * u, sy0 + (ty - sy0) * u, ang, L, ft < 30 ? 0 : Math.min(1, (ft - 30) / 14));
                if (ft >= 44 && ft < 74) {
                    h.briga = 2;
                    for (k = 0; k < 2; k++) h.sang.push({ x: h.x + (Math.random() - 0.5) * BW, y: h.y - Math.random() * BH, vx: (Math.random() - 0.5) * p, vy: -Math.random() * p * 1.5, v: 25, c: '#39d353', s: Math.max(3, p) });
                }
                if (ft >= 74) { // vira jacaré: só rasteja
                    h.forma = 'jacare'; h.estagio = 2; h.jc = 0; aplicarForma(h);
                    h.estado = 'vivo'; h.fase = 0; h.morte = ''; h.ft = 0; h.briga = 0; h.vx = (Math.random() < 0.5 ? -1 : 1) * Math.abs(h.vx);
                }
            }
            function animarTiro(h, ft, agora) {
                var sh = null, shq; for (shq = 0; shq < j.hs.length; shq++) if (j.hs[shq].tipo === 2) sh = j.hs[shq]; var tx = h.x, ty = h.y - BH * 0.3;
                var sx = sh ? sh.x : W - 30, sy = sh ? sh.y : H, dir = tx >= sx ? 1 : -1, gx = sx + dir * 6 * p, gy = sy - 11 * p;
                if (ft < 40) { g.fillStyle = '#222'; g.fillRect(dir > 0 ? gx - p : gx - 5 * p, gy, 6 * p, 2 * p); g.fillRect(dir > 0 ? gx - p : gx - p, gy + 2 * p, 2 * p, 3 * p); }
                if (ft === 40) h.bala = { x: gx, y: gy };
                if (ft >= 40 && h.bala && !h.boom) {
                    var u = Math.min(1, (ft - 40) / 8), bx = h.bala.x + (tx - h.bala.x) * u, by = h.bala.y + (ty - h.bala.y) * u;
                    g.fillStyle = '#ffdf00'; g.beginPath(); g.arc(h.bala.x, h.bala.y, Math.max(3, p * 2.2) * (1 - (ft - 40) / 8 * 0.8) + 1, 0, 6.2832, false); g.fill();
                    g.fillStyle = '#ffe9a0'; g.fillRect(bx - p, by - p * 0.5, 3 * p, p);
                    if (u >= 1) { h.boom = true; h.tFim = agora; j.cabecas++; h.estado = 'morto'; h.vx = 0; var k; for (k = 0; k < 14; k++) h.sang.push({ x: tx, y: ty, vx: (Math.random() - 0.5) * p * 2, vy: -Math.random() * p * 2, v: 35 + Math.random() * 25 }); }
                }
                if (h.boom && agora - h.tFim >= 1500) h.acabou = true;
            }
            function desenharLhama(x, y, bica) { // bica: 0 (cabeça erguida) a 1 (bicando o chão) — vem bicar o gado caído até ele se reconstruir
                var cC = '#e8d9b0', cE = '#c9b385', hx = x - 7 * p, hy = y - 13 * p + bica * 9 * p;
                g.save();
                g.fillStyle = cE; g.fillRect(x - 3.5 * p, y - 2 * p, 2.2 * p, 2 * p); g.fillRect(x + 1.3 * p, y - 2 * p, 2.2 * p, 2 * p);
                g.fillStyle = cC; g.fillRect(x - 5 * p, y - 12 * p, 10 * p, 8 * p);
                g.fillStyle = cE; g.fillRect(x + 1.5 * p, y - 11.5 * p, 3 * p, 3 * p);
                g.strokeStyle = cC; g.lineWidth = 2.2 * p; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 3 * p, y - 10 * p); g.lineTo(hx + 1.5 * p, hy + 2 * p); g.stroke();
                g.fillStyle = cC; g.fillRect(hx - 1.5 * p, hy - 1.5 * p, 3.6 * p, 3 * p);
                g.fillStyle = cE; g.fillRect(hx - 2.6 * p, hy - 3 * p, 1.4 * p, 2 * p); g.fillRect(hx - 0.6 * p, hy - 3 * p, 1.4 * p, 2 * p);
                g.fillStyle = '#111'; g.fillRect(hx + 1.2 * p, hy - 0.8 * p, 0.8 * p, 0.8 * p);
                g.restore();
            }
            // gado (boi): o disco voador leva, some uns segundos, volta e solta — o gado cai e se espatifa no chão,
            // a lhama bica ele até reconstruir e voltar a andar; depois de 5 vezes, vira o patriota (volta à forma humana)
            function animarGado(h, ft, agora) {
                var W2 = S * 0.9;
                if (!h.abd0) { // 1) disco desce e agarra o gado
                    var uyT0 = Math.max(S * 0.6, h.y - BH * 5);
                    var uy0 = -S * 0.5 + (uyT0 + S * 0.5) * suave(ft / 50);
                    var ux0 = h.x - W * 0.3 * (1 - suave(ft / 50));
                    ovni(ux0, uy0, W2);
                    if (ft >= 50) { h.abd0 = ft; h.estado = 'abduzido'; h.vy = 0; h.vx = 0; }
                    return;
                }
                var uyT = Math.max(S * 0.6, h.y - BH * 5), ux = h.x;
                if (!h.oculto && !h.gVoltaFt) { // 2) sobe levando o gado até sair de vista
                    var uy = uyT;
                    g.fillStyle = 'rgba(190,255,190,0.35)'; g.beginPath(); g.moveTo(ux - W2 * 0.18, uy + W2 * 0.04); g.lineTo(ux + W2 * 0.18, uy + W2 * 0.04); g.lineTo(h.x + W2 * 0.4, h.y + 6); g.lineTo(h.x - W2 * 0.4, h.y + 6); g.closePath(); g.fill();
                    ovni(ux, uy, W2);
                    h.y -= BH * 0.1; h.tomba = Math.sin(ft * 0.3) * 0.3; h.sdir = 1;
                    if (h.y <= uyT + W2 * 0.1) { h.oculto = true; h.abd1 = ft; j.cabecas++; }
                    return;
                }
                if (!h.gVoltaFt) { // 3) voa pra fora da tela e some uns segundos
                    var u2 = (ft - h.abd1) / 45;
                    if (u2 < 1) { ovni(ux + (W + W2 - ux) * suave(u2), uyT - (uyT + S) * suave(u2) * 0.6, W2); return; }
                    if (!h.gOffT) { h.gOffT = agora; return; }
                    if (agora - h.gOffT < 2200) return;   // espera uns segundos fora da tela
                    h.gVoltaFt = ft;
                }
                if (!h.gCaindo) { // 4) o disco volta e solta o gado
                    var u3 = Math.min(1, (ft - h.gVoltaFt) / 50);
                    var sx = ux + (W + W2 - ux), sy = uyT - (uyT + S) * 0.6;
                    ovni(sx + (ux - sx) * suave(u3), sy + (uyT - sy) * suave(u3), W2);
                    if (u3 >= 1) { h.oculto = false; h.y = uyT; h.estado = 'parado'; h.vy = 0; h.gCaindo = true; h.gCaindoFt = ft; }
                    return;
                }
                if (!h.gSplat) { // 5) cai (a física comum do jogo cuida da queda e do pouso no chão/obstáculo)
                    if (ft - h.gCaindoFt > 4 && h.vy === 0) {
                        h.gSplat = true; h.gSplatT0 = agora; h.gSplatVisual = true;
                        var k; for (k = 0; k < 16; k++) h.sang.push({ x: h.x + (Math.random() - 0.5) * BW, y: h.y - 2 * p, vx: (Math.random() - 0.5) * p * 4, vy: -Math.random() * p * 2.5, v: 25 + Math.random() * 20, c: '#c9a876', s: Math.max(2, p) });
                    }
                    return;
                }
                // 6) a lhama bica o gado espatifado até ele se reconstruir
                var dt = agora - h.gSplatT0, bica = Math.abs(Math.sin(dt * 0.012));
                desenharLhama(h.x + BW * 1.3 * (h.dir < 0 ? -1 : 1), h.y, bica);
                if (bica > 0.92 && (!h.gUltBico || dt - h.gUltBico > 180)) {
                    h.gUltBico = dt;
                    var k2; for (k2 = 0; k2 < 5; k2++) h.sang.push({ x: h.x, y: h.y - 2 * p, vx: (Math.random() - 0.5) * p * 2, vy: -Math.random() * p * 1.3, v: 14, c: '#c9a876', s: Math.max(2, p) });
                }
                if (dt < 2200) return;
                // 7) reconstrói e volta a andar (até 5 vezes; depois disso vira o patriota, de volta à forma humana verde/amarela)
                h.gSplatVisual = false;
                h.gc = (h.gc || 0) + 1;
                if (h.gc >= 5) { h.forma = 'patriota'; h.estagio = 4; } else { h.forma = 'boi'; }
                aplicarForma(h);
                h.estado = 'vivo'; h.fase = 0; h.morte = ''; h.ft = 0; h.briga = 0; h.tomba = 0;
                h.vx = (Math.random() < 0.5 ? -1 : 1) * Math.abs(h.vx || VEL);
                h.abd0 = null; h.abd1 = null; h.gVoltaFt = null; h.gOffT = null; h.gCaindo = false; h.gCaindoFt = null; h.gSplat = false; h.gSplatT0 = null; h.gUltBico = null;
            }
            function animarBandeira(h, ft, agora) {
                var fw = S * 0.9, fh = S * 0.55, y0 = -fh, y1 = h.y - fh * 0.95, tm = Math.min(1, ft / 18), q;
                bandeiraCuba(h.x - fw / 2, y0 + (y1 - y0) * tm * tm, fw, fh);
                if (tm >= 1 && !h.crush) { h.crush = true; h.tCrush = agora; j.cabecas++; for (q = 0; q < 24; q++) h.sang.push({ x: h.x, y: h.y - 4, vx: (Math.random() - 0.5) * p * 3, vy: -Math.random() * p * 2.2, v: 40 + Math.random() * 30 }); }
                if (h.crush && agora - h.tCrush >= 1500) h.acabou = true;
            }
            // míssil que mata um personagem perto de outro: a explosão leva os dois; depois disso surge o herói voador
            function explodirVizinhos(h) {
                var n = 0, q, o;
                for (q = 0; q < j.hs.length; q++) {
                    o = j.hs[q];
                    if (o === h || o.estado !== 'vivo' || o.fase !== 0 || o.tipo === 4) continue;
                    if (Math.abs(o.x - h.x) < S * 0.6 && Math.abs(o.y - h.y) < BH * 3) { o.estado = 'parado'; o.vx = 0; o.fase = 1; o.ft = 0; o.morte = 'explosao'; n++; }
                }
                if (n > 0 && !j.heroiLib) { j.heroiLib = true; j.heroiQuando = Date.now() + 2500; }
            }
            function animarMorte(h) {
                var ft = h.ft++, agora = Date.now(), k, m = h.morte;
                if (m === 'chicote') { if (h.tomba < 1.5) h.tomba += 0.07; if (agora - h.tFim >= 2200) h.acabou = true; return; }
                if (m === 'decap') { if (h.tomba < 1.5) h.tomba += 0.07; if (agora - h.tFim >= 2200) h.acabou = true; return; }
                if (m === 'ema') { animarEma(h, ft, agora); return; }
                if (m === 'raio') { animarRaio(h, ft, agora); return; }
                if (m === 'flecha') { animarFlecha(h); return; }
                if (m === 'vacina') { animarVacina(h, ft); return; }
                if (m === 'tiro') { animarTiro(h, ft, agora); return; }
                if (m === 'abducao') { animarGado(h, ft, agora); return; }
                if (m === 'bandeira') { animarBandeira(h, ft, agora); return; }
                if (m === 'explosao' && !h.boom) { // atingido pela explosão de um míssil que matou alguém perto
                    h.boom = true; h.tFim = agora; j.cabecas++; h.estado = 'morto'; h.vx = 0; h.expl = { x: h.x, y: h.y - BH * 0.5, t: 22 };
                    var cs2 = ['#ff8c00', '#ffdf00', '#444', '#d4202a'];
                    for (k = 0; k < 60; k++) h.sang.push({ x: h.x, y: h.y - BH * 0.5, vx: (Math.random() - 0.5) * p * 5, vy: -Math.random() * p * 4, v: 30 + Math.random() * 40, c: cs2[k % 4], s: Math.max(3, p * 1.5) });
                }
                if (m === 'foguete' || m === 'aviao' || m === 'explosao') {
                    var av = m === 'aviao', tx = h.x, ty = h.y - BH * 0.5;
                    var sx = av ? (tx < W / 2 ? W + 90 : -90) : icX, sy = av ? -50 : icY;
                    var cx = av ? (sx + tx) / 2 : (icX < W / 2 ? W * 0.9 : W * 0.1), cy = av ? Math.max(10, ty * 0.15) : Math.max(20, H * 0.08), dur = av ? 150 : 120;
                    if (!h.boom) {
                        var u = Math.min(1, ft / dur), v = 1 - u;
                        var fx = v * v * sx + 2 * v * u * cx + u * u * tx, fy = v * v * sy + 2 * v * u * cy + u * u * ty;
                        var dx = 2 * v * (cx - sx) + 2 * u * (tx - cx), dy = 2 * v * (cy - sy) + 2 * u * (ty - cy);
                        if (!h.fum) h.fum = [];
                        h.fum.push({ x: fx, y: fy, v: 30 });
                        if (av) aviaoDes(fx, fy, Math.atan2(dy, dx), S * 0.7); else foguete(fx, fy, Math.atan2(dy, dx), S * 0.45);
                        if (u >= 1) {
                            h.boom = true; h.tFim = agora; j.cabecas++; h.estado = 'morto'; h.vx = 0;
                            h.expl = { x: tx, y: ty, t: 22 };
                            if (m === 'foguete') explodirVizinhos(h);
                            var cs = ['#ff8c00', '#ffdf00', '#444', '#d4202a'];
                            for (k = 0; k < 60; k++) h.sang.push({ x: tx, y: ty, vx: (Math.random() - 0.5) * p * 5, vy: -Math.random() * p * 4, v: 30 + Math.random() * 40, c: cs[k % 4], s: Math.max(3, p * 1.5) });
                        }
                    }
                    for (k = (h.fum || []).length - 1; k >= 0; k--) {
                        var fm = h.fum[k]; fm.v--;
                        g.fillStyle = (av ? 'rgba(70,70,70,' : 'rgba(150,150,150,') + Math.max(0, fm.v / 40).toFixed(2) + ')';
                        g.beginPath(); g.arc(fm.x, fm.y, p * 1.4 + (30 - fm.v) * 0.12, 0, 6.28); g.fill();
                        if (fm.v <= 0) h.fum.splice(k, 1);
                    }
                    if (h.expl && h.expl.t > 0) {
                        var e = h.expl; e.t--;
                        g.fillStyle = 'rgba(255,140,0,' + (e.t / 22).toFixed(2) + ')'; g.beginPath(); g.arc(e.x, e.y, S * 0.5 * (1 - e.t / 22) + p * 3, 0, 6.28); g.fill();
                        g.fillStyle = 'rgba(255,240,150,' + (e.t / 22).toFixed(2) + ')'; g.beginPath(); g.arc(e.x, e.y, S * 0.25 * (1 - e.t / 22) + p * 2, 0, 6.28); g.fill();
                    }
                    if (h.boom && agora - h.tFim >= 2000) h.acabou = true;
                    return;
                }
                // guilhotina (o carrasco só existe 1 vez na tela; depois do serviço ele sai da página)
                var topo = Math.max(p * 4, h.y - BH * 3.0), pesc = h.y - BH * 0.95, gx = h.x;
                if (!h.carrasco) { var rv2 = novo(3); rv2.rev = true; rv2.y = h.y; rv2.solo = true; rv2.x = h.x < W / 2 ? W + BW : -BW; rv2.alvoX = Math.max(BW * 2, Math.min(W - BW * 2, h.x + (h.x < W / 2 ? BW * 4.5 : -BW * 4.5))); h.carrasco = rv2; j.carr = rv2; h.lamina = topo; h.puxar = 0; }
                var rv3 = h.carrasco;
                if (Math.abs(rv3.x - rv3.alvoX) > VEL * 1.6) { var sd2 = rv3.x < rv3.alvoX ? 1 : -1; rv3.x += sd2 * VEL * 1.5; rv3.dir = sd2; rv3.andar++; rv3.solo = true; }
                else { rv3.dir = h.x > rv3.x ? 1 : -1; rv3.andar = 0; if (!h.puxar) h.puxar = ft; }
                g.fillStyle = '#7a5230'; g.fillRect(gx - BW * 1.0, topo - p * 3, p * 1.6, h.y - topo + p * 3); g.fillRect(gx + BW * 1.0 - p * 1.6, topo - p * 3, p * 1.6, h.y - topo + p * 3);
                g.fillRect(gx - BW * 1.0, topo - p * 3, BW * 2, p * 1.6); g.fillRect(gx - BW * 1.2, h.y, BW * 2.4, p * 1.5);
                if (h.puxar && ft - h.puxar > 22 && !h.caindo && !h.cab && h.estado === 'parado') h.caindo = true;
                if (h.caindo && h.lamina < pesc) { h.lamina += (pesc - topo) / 9; if (h.lamina >= pesc) { h.lamina = pesc; h.caindo = false; cortar(h); h.tFim = agora; } }
                g.fillStyle = '#cfd5da'; g.beginPath(); g.moveTo(gx - BW * 0.95, h.lamina - p * 3); g.lineTo(gx + BW * 0.95, h.lamina - p * 3); g.lineTo(gx + BW * 0.95, h.lamina); g.lineTo(gx - BW * 0.95, h.lamina + p * 1.2); g.closePath(); g.fill();
                g.strokeStyle = '#333'; g.lineWidth = 1; g.stroke();
                g.strokeStyle = '#c9a66b'; g.lineWidth = Math.max(2, p * 0.6); g.beginPath(); g.moveTo(gx, h.lamina - p * 3); g.lineTo(gx, topo - p * 3); g.lineTo(rv3.x + rv3.dir * BW * 0.6, rv3.y - BH * 0.5); g.stroke();
                humano(rv3);
                if (h.estado === 'corte' || h.estado === 'morto') {
                    if (!h.tFim) h.tFim = agora;
                    if (agora - h.tFim >= 3000) { h.acabou = true; rv3.saindo = true; }
                }
            }
            function suave(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
            function animarFerramentas(h) {
                var ft = h.ft++, vooFim = 70, agora = Date.now();
                var soM = h.morte === 'martelo', soF = h.morte === 'foice';
                if (soM && !h.tCorte) h.tCorte = agora - 4000;   // só o martelo: cai direto
                if (!soM) {
                    var k = suave(ft / vooFim), px = h.x, ny = h.y - BH * 0.85, tam = icS + (S - icS) * k;
                    var fx = icX + (px - S * 0.35 - icX) * k, fy = icY + ((ny) - icY) * k - Math.sin(k * 3.14) * H * 0.12;
                    var ang = -2.4 + (ft / vooFim) * 12.5;                       // gira enquanto voa
                    if (ft >= vooFim) { // foice corta o pescoço (12 quadros)
                        var tc = Math.min(1, (ft - vooFim) / 12);
                        ang = -2.4 + tc * 3.8; fx = px; fy = ny;
                        if (ft - vooFim >= 6 && h.estado === 'parado') { cortar(h); h.tCorte = Date.now(); }
                        if (tc >= 1) { ang = 1.4; fx = px - S * 0.2; fy = ny; }
                    }
                    foiceDes(fx, fy, tam * 0.55, ang);
                }
                if (soF) { if (h.tCorte && agora - h.tCorte >= 1500) h.acabou = true; return; }
                if (!h.tCorte || agora - h.tCorte < 4000) martelo(icX, icY, icS * 1.4, 0);   // espera 4 s depois do corte
                else {
                    if (!h.quedaF) h.quedaF = 0;
                    var tm = Math.min(1, (h.quedaF++) / 14), y0 = -S, y1 = h.y - S * 0.38;
                    martelo(h.x, y0 + (y1 - y0) * tm * tm, S, 0);
                    if (tm >= 1 && !h.crush) { h.crush = true; h.tCrush = agora; if (soM) j.cabecas++; var q; for (q = 0; q < 30; q++) h.sang.push({ x: h.x, y: h.y - 4, vx: (Math.random() - 0.5) * p * 3, vy: -Math.random() * p * 2.2, v: 40 + Math.random() * 30 }); }
                    if (h.crush && agora - h.tCrush >= 1000) h.acabou = true;
                }
            }
            // ---------- herói voador ORIGINAL ("Coruja") e vilões ORIGINAIS que o eletrocutam com um taser ----------
            var VIL = ['palhaco', 'barao', 'gelo'];
            function novoHeroi() {
                return { x: W * (0.2 + Math.random() * 0.6), y: -BH * 2, vx: VEL * 1.1 * (Math.random() < 0.5 ? -1 : 1), vy: 0, t: 0, ft: 0, estado: 'voa', dir: 1, tm: 0 };
            }
            function desenharHeroi(h) {
                var d = h.dir, x = h.x + (h.estado === 'choque' ? (Math.random() - 0.5) * p * 2 : 0), y = h.y, fl = Math.sin(h.t * 0.25), xr = h.estado === 'choque' && (h.ft % 6 < 3);
                var capa = xr ? '#e5e7eb' : '#1e40af', corpo = xr ? '#ffffff' : '#334155', pele = xr ? '#ffffff' : '#f1c9a5', det = xr ? '#000000' : '#facc15', mas = xr ? '#000' : '#0f172a';
                g.save();
                if (h.estado === 'morto') { g.translate(x, y); g.rotate(1.5708 * d); g.translate(-x, -y); }
                // capa balançando atrás
                g.fillStyle = capa; g.beginPath();
                g.moveTo(x - d * 2 * p, y - 6 * p); g.lineTo(x - d * (9 + fl * 2) * p, y - 4 * p + fl * p);
                g.lineTo(x - d * (12 + fl * 2) * p, y + 2 * p); g.lineTo(x - d * (9 + fl) * p, y + 1 * p);
                g.lineTo(x - d * (10 + fl * 2) * p, y + 6 * p); g.lineTo(x - d * 3 * p, y + 3 * p); g.closePath(); g.fill();
                // pernas e botas
                g.fillStyle = corpo; g.fillRect(x - 3.5 * p - d * p, y + 4 * p, 3 * p, 5.5 * p); g.fillRect(x + 0.5 * p - d * 2 * p, y + 4 * p, 3 * p, 5 * p);
                g.fillStyle = det; g.fillRect(x - 3.8 * p - d * p, y + 8.2 * p, 3.6 * p, 1.6 * p); g.fillRect(x + 0.2 * p - d * 2 * p, y + 7.7 * p, 3.6 * p, 1.6 * p);
                // tronco, emblema (pena) e cinto
                g.fillStyle = corpo; g.fillRect(x - 4 * p, y - 6 * p, 8 * p, 10 * p);
                g.fillStyle = det; g.beginPath(); g.arc(x, y - 2 * p, 2 * p, 0, 6.2832, false); g.fill();
                g.fillStyle = corpo; g.beginPath(); g.arc(x, y - 2 * p, 1 * p, 0, 6.2832, false); g.fill();
                g.fillStyle = det; g.fillRect(x - 4 * p, y + 2.6 * p, 8 * p, 1.4 * p);
                // braço da frente esticado (voando) e o de trás
                g.strokeStyle = corpo; g.lineWidth = 2.4 * p; g.lineCap = 'round';
                g.beginPath(); g.moveTo(x + d * 3 * p, y - 5 * p); g.lineTo(x + d * 10 * p, y - 7 * p); g.stroke();
                g.beginPath(); g.moveTo(x - d * 3 * p, y - 5 * p); g.lineTo(x - d * 5 * p, y + 1 * p); g.stroke();
                g.fillStyle = pele; g.beginPath(); g.arc(x + d * 10.5 * p, y - 7.2 * p, 1.4 * p, 0, 6.2832, false); g.fill();
                // cabeça com máscara de coruja (olhos redondos) e dois tufos redondos
                g.fillStyle = pele; g.beginPath(); g.arc(x, y - 9 * p, 3.4 * p, 0, 6.2832, false); g.fill();
                g.fillStyle = mas; g.fillRect(x - 3.4 * p, y - 10.4 * p, 6.8 * p, 2.8 * p);
                g.beginPath(); g.arc(x - 2.6 * p, y - 12 * p, 1.3 * p, 0, 6.2832, false); g.fill(); g.beginPath(); g.arc(x + 2.6 * p, y - 12 * p, 1.3 * p, 0, 6.2832, false); g.fill();
                g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 1.5 * p, y - 9.1 * p, 1.1 * p, 0, 6.2832, false); g.fill(); g.beginPath(); g.arc(x + 1.5 * p, y - 9.1 * p, 1.1 * p, 0, 6.2832, false); g.fill();
                g.fillStyle = '#000'; g.fillRect(x - 1.5 * p + d * 0.4 * p, y - 9.4 * p, 0.7 * p, 0.7 * p); g.fillRect(x + 1.5 * p + d * 0.4 * p, y - 9.4 * p, 0.7 * p, 0.7 * p);
                g.restore();
            }
            function desenharVilao(v) {
                var d = v.dir, x = v.x, y = v.y, pas = Math.sin(v.andar * 0.5) * 1.6 * p, k = v.kind;
                g.save(); if (v.fase === 'morto') { g.translate(x, y); g.rotate(1.5708 * d); g.translate(-x, -y); }
                var terno = k === 'palhaco' ? '#1d4ed8' : (k === 'barao' ? '#7f1d1d' : '#7dd3fc'), calca = k === 'palhaco' ? '#facc15' : (k === 'barao' ? '#292524' : '#0f172a');
                var larg = k === 'barao' ? 12 : 8;
                g.fillStyle = calca; g.fillRect(x - 3.5 * p + pas * 0.5, y - 6 * p, 3 * p, 6 * p); g.fillRect(x + 0.5 * p - pas * 0.5, y - 6 * p, 3 * p, 6 * p);
                g.fillStyle = '#111'; g.fillRect(x - 3.8 * p + pas * 0.5 + (d > 0 ? 0 : -p), y - 1.2 * p, 4 * p, 1.2 * p); g.fillRect(x + 0.2 * p - pas * 0.5 + (d > 0 ? 0 : -p), y - 1.2 * p, 4 * p, 1.2 * p);
                g.fillStyle = terno; g.fillRect(x - larg / 2 * p, y - 13 * p, larg * p, 7.5 * p);
                if (k === 'palhaco') { g.fillStyle = '#ef4444'; g.beginPath(); g.moveTo(x, y - 12 * p); g.lineTo(x - 2 * p, y - 13.4 * p); g.lineTo(x - 2 * p, y - 10.8 * p); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x, y - 12 * p); g.lineTo(x + 2 * p, y - 13.4 * p); g.lineTo(x + 2 * p, y - 10.8 * p); g.closePath(); g.fill();
                    g.fillStyle = '#fde047'; g.beginPath(); g.arc(x, y - 9.5 * p, 0.8 * p, 0, 6.2832, false); g.fill(); g.beginPath(); g.arc(x, y - 7.5 * p, 0.8 * p, 0, 6.2832, false); g.fill(); }
                if (k === 'barao') { g.fillStyle = '#fef3c7'; g.fillRect(x - 2.5 * p, y - 12.6 * p, 5 * p, 6.5 * p); g.fillStyle = '#ca8a04'; g.fillRect(x - 0.4 * p, y - 12 * p, 0.8 * p, 5 * p); }
                if (k === 'gelo') { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 4 * p, y - 13 * p); g.lineTo(x - 5.5 * p, y - 16 * p); g.lineTo(x - 2.5 * p, y - 13 * p); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x + 4 * p, y - 13 * p); g.lineTo(x + 5.5 * p, y - 16 * p); g.lineTo(x + 2.5 * p, y - 13 * p); g.closePath(); g.fill(); }
                // cabeça
                var hy = y - 16.5 * p;
                if (k === 'palhaco') {
                    g.fillStyle = '#fb923c'; g.beginPath(); g.arc(x - 3.3 * p, hy - 0.5 * p, 1.9 * p, 0, 6.2832, false); g.fill(); g.beginPath(); g.arc(x + 3.3 * p, hy - 0.5 * p, 1.9 * p, 0, 6.2832, false); g.fill(); g.beginPath(); g.arc(x, hy - 2.6 * p, 1.9 * p, 0, 6.2832, false); g.fill();
                    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, hy, 3.3 * p, 0, 6.2832, false); g.fill();
                    g.fillStyle = '#ef4444'; g.beginPath(); g.arc(x + d * 2.6 * p, hy + 0.2 * p, 1 * p, 0, 6.2832, false); g.fill();
                    g.fillStyle = '#111'; g.fillRect(x + d * 1 * p - 0.5 * p, hy - 1.4 * p, p, p); g.fillRect(x - d * 1 * p - 0.5 * p, hy - 1.4 * p, p, p);
                    g.fillStyle = '#ef4444'; g.fillRect(x - 1.6 * p, hy + 1.4 * p, 3.2 * p, 0.8 * p);
                } else if (k === 'barao') {
                    g.fillStyle = '#f1c9a5'; g.beginPath(); g.arc(x, hy, 3 * p, 0, 6.2832, false); g.fill();
                    g.fillStyle = '#1c1917'; g.fillRect(x - 3.6 * p, hy - 3.2 * p, 7.2 * p, 1 * p); g.fillRect(x - 2.6 * p, hy - 8 * p, 5.2 * p, 4.8 * p);
                    g.fillStyle = '#b91c1c'; g.fillRect(x - 2.6 * p, hy - 4.4 * p, 5.2 * p, 1.2 * p);
                    g.fillStyle = '#1c1917'; g.fillRect(x - 2.4 * p, hy + 0.6 * p, 4.8 * p, 0.9 * p);
                    g.strokeStyle = '#ca8a04'; g.lineWidth = Math.max(1, 0.5 * p); g.beginPath(); g.arc(x + d * 1.3 * p, hy - 0.8 * p, 1.2 * p, 0, 6.2832, false); g.stroke();
                    g.fillStyle = '#111'; g.fillRect(x + d * 1.3 * p - 0.4 * p, hy - 1 * p, 0.8 * p, 0.8 * p); g.fillRect(x - d * 1.3 * p - 0.4 * p, hy - 1 * p, 0.8 * p, 0.8 * p);
                } else {
                    g.fillStyle = '#bae6fd'; g.beginPath(); g.arc(x, hy, 3.2 * p, 0, 6.2832, false); g.fill();
                    g.fillStyle = '#0f172a'; g.fillRect(x - 3.4 * p, hy - 1.6 * p, 6.8 * p, 2 * p);
                    g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 1.5 * p, hy - 0.6 * p, 1.1 * p, 0, 6.2832, false); g.fill(); g.beginPath(); g.arc(x + 1.5 * p, hy - 0.6 * p, 1.1 * p, 0, 6.2832, false); g.fill();
                    g.fillStyle = '#0369a1'; g.fillRect(x - 1.5 * p, hy + 1.3 * p, 3 * p, 0.7 * p);
                }
                // braço: pendurado ou apontando o taser
                var sx = x + d * 4 * p, sy = y - 11.5 * p, ang = d > 0 ? 1.3 : Math.PI - 1.3, taser = false;
                if (v.fase === 'mira' || v.fase === 'tiro' || v.fase === 'choque') { ang = Math.atan2(v.hy - sy, v.hx - sx); taser = true; }
                g.save(); g.translate(sx, sy); g.rotate(ang);
                g.fillStyle = terno; g.fillRect(0, -1.1 * p, 5 * p, 2.2 * p);
                g.fillStyle = '#f1c9a5'; g.fillRect(5 * p, -1.1 * p, 1.6 * p, 2.2 * p);
                if (taser) { g.fillStyle = '#111'; g.fillRect(5.5 * p, -1.6 * p, 4.5 * p, 3.2 * p); g.fillStyle = '#facc15'; g.fillRect(6 * p, -1.1 * p, 2.5 * p, 2.2 * p); g.fillStyle = '#e5e7eb'; g.fillRect(10 * p, -0.7 * p, 1.2 * p, 1.4 * p); }
                g.restore();
                g.restore();
                v.mx = sx + Math.cos(ang) * 11 * p; v.my = sy + Math.sin(ang) * 11 * p;   // boca do taser
            }
            function fioTaser(ax, ay, bx, by, tremer) {
                var n = 9, i, px = ax, py = ay, nx, ny, dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy) || 1, ox = -dy / L, oy = dx / L, jt;
                g.strokeStyle = '#e0f2fe'; g.lineWidth = Math.max(1.5, p * 0.5); g.beginPath(); g.moveTo(ax, ay);
                for (i = 1; i <= n; i++) {
                    jt = (i < n && tremer) ? (Math.random() - 0.5) * p * 4 : 0;
                    nx = ax + dx * i / n + ox * jt; ny = ay + dy * i / n + oy * jt; g.lineTo(nx, ny);
                }
                g.stroke();
            }
            function raios(cx, cy) {
                var k, i, px, py, a, r, c;
                for (k = 0; k < 6; k++) {
                    a = Math.random() * 6.2832; px = cx; py = cy; r = S * (0.18 + Math.random() * 0.2) / 5;
                    for (c = 0; c < 2; c++) {
                        g.strokeStyle = c ? '#ffffff' : '#38bdf8'; g.lineWidth = c ? 1 : Math.max(2, p * 0.7); g.beginPath(); g.moveTo(cx, cy); px = cx; py = cy; a = a;
                        for (i = 0; i < 5; i++) { a += (Math.random() - 0.5) * 1.6; px += Math.cos(a) * r; py += Math.sin(a) * r; g.lineTo(px, py); }
                        g.stroke();
                    }
                }
            }
            function matarHeroi() {
                var h = j.heroi, lado = h.x < W / 2 ? 1 : -1;
                h.estado = 'alvo'; h.vx = 0; h.ft = 0;
                var kind = VIL[(j.vilIdx || 0) % VIL.length]; j.vilIdx = (j.vilIdx || 0) + 1;
                j.vil = { kind: kind, x: lado > 0 ? W + BW * 2 : -BW * 2, y: H, dir: -lado, andar: 0, fase: 'entra', ft: 0, hx: h.x, hy: h.y,
                          alvoX: Math.max(BW * 2, Math.min(W - BW * 2, h.x + lado * BW * 3.5)), mx: 0, my: 0 };
            }

            // ---------- ema gigante: ataca o senhor grisalho, arranca a cabeça, "come" e cospe ----------
            function desenharEma(em, y, vh, cabecaNoBico, bojo) {
                var d = em.dir, x = em.x, k, sw = Math.sin(em.andar * 0.42) * 5 * p, Sx = x + d * 10 * p, Sy = y - 32 * p, Hx = em.hx, Hy = em.hy;
                var Cx = Sx + d * 2 * p, Cy = Math.min(Sy, Hy) - 6 * p;
                // pernas
                g.strokeStyle = '#8a7a68'; g.lineWidth = 2.2 * p; g.lineCap = 'round';
                for (k = 0; k < 2; k++) {
                    var fx = x + (k ? 3 : -4) * p + (k ? -sw : sw) * (em.andando ? 1 : 0.1);
                    g.beginPath(); g.moveTo(x + (k ? 3 : -4) * p, y - 22 * p); g.lineTo(fx, y - 1 * p); g.stroke();
                    g.lineWidth = 1.2 * p; g.beginPath(); g.moveTo(fx - 3 * p, y - p * 0.5); g.lineTo(fx + 4 * p, y - p * 0.5); g.stroke(); g.lineWidth = 2.2 * p;
                }
                // cauda de penas e corpo felpudo
                g.fillStyle = '#5a4c3b'; g.save(); g.translate(x - d * 12 * p, y - 29 * p); g.scale(1, 1.2); g.beginPath(); g.arc(0, 0, 6 * p, 0, 6.2832, false); g.restore(); g.fill();
                g.fillStyle = '#6f5f4b'; g.save(); g.translate(x, y - 27 * p); g.scale(1, 0.68); g.beginPath(); g.arc(0, 0, 14 * p, 0, 6.2832, false); g.restore(); g.fill();
                g.strokeStyle = '#4a3d30'; g.lineWidth = Math.max(1, p * 0.5);
                for (k = 0; k < 9; k++) { g.beginPath(); g.moveTo(x - 11 * p + k * 2.8 * p, y - 33 * p + (k % 3) * 2 * p); g.lineTo(x - 12 * p + k * 2.8 * p, y - 27 * p + (k % 3) * 2 * p); g.stroke(); }
                // pescoço
                g.strokeStyle = '#7f95a6'; g.lineWidth = 4.4 * p; g.beginPath(); g.moveTo(Sx, Sy); g.quadraticCurveTo(Cx, Cy, Hx, Hy); g.stroke();
                g.strokeStyle = '#a9bac6'; g.lineWidth = 1.6 * p; g.beginPath(); g.moveTo(Sx, Sy); g.quadraticCurveTo(Cx, Cy, Hx, Hy); g.stroke();
                if (bojo !== null && bojo !== undefined) { // a cabeça descendo pelo pescoço
                    var s2 = bojo, bx2 = (1 - s2) * (1 - s2) * Hx + 2 * (1 - s2) * s2 * Cx + s2 * s2 * Sx, by2 = (1 - s2) * (1 - s2) * Hy + 2 * (1 - s2) * s2 * Cy + s2 * s2 * Sy;
                    g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(bx2, by2, 3.4 * p, 0, 6.2832, false); g.fill();
                    g.fillStyle = '#d6d6d6'; g.fillRect(bx2 - 3.4 * p, by2 - p, p, 2 * p); g.fillRect(bx2 + 2.4 * p, by2 - p, p, 2 * p);
                }
                // cabeça da ema e bico
                g.fillStyle = '#6f8190'; g.beginPath(); g.arc(Hx, Hy, 3.2 * p, 0, 6.2832, false); g.fill();
                var ab = em.bico || 0;
                g.fillStyle = '#3a3a3a';
                g.beginPath(); g.moveTo(Hx + d * 2 * p, Hy - 1.4 * p - ab * 1.4 * p); g.lineTo(Hx + d * 8 * p, Hy - 0.2 * p - ab * 1.2 * p); g.lineTo(Hx + d * 2 * p, Hy + 0.2 * p); g.closePath(); g.fill();
                g.beginPath(); g.moveTo(Hx + d * 2 * p, Hy + 0.4 * p); g.lineTo(Hx + d * 7 * p, Hy + 0.8 * p + ab * 2 * p); g.lineTo(Hx + d * 2 * p, Hy + 2 * p); g.closePath(); g.fill();
                g.fillStyle = '#f59e0b'; g.beginPath(); g.arc(Hx + d * 0.6 * p, Hy - 1 * p, 1 * p, 0, 6.2832, false); g.fill();
                g.fillStyle = '#000'; g.beginPath(); g.arc(Hx + d * 0.8 * p, Hy - 1 * p, 0.45 * p, 0, 6.2832, false); g.fill();
                if (cabecaNoBico) { g.save(); g.translate(Hx + d * 5 * p, Hy + 1 * p); g.rotate(em.rotc || 0); cabeca(0, -3 * p, d, 4); g.restore(); }
            }
            function animarEma(h, ft, agora) {
                var em = h.ema, d, y = h.y, rx, ry, vhx = h.x, vhy = h.y - BH * 0.9, k, u;
                if (!em) {
                    d = h.x > W / 2 ? 1 : -1;
                    var x0 = d > 0 ? -34 * p : W + 34 * p;
                    var dir0 = 0; if (j.emaR) { x0 = j.emaR.x; d = h.x >= x0 ? 1 : -1; dir0 = j.emaR.dir; j.emaR = null; }   // é a própria ema que estava fugindo dele
                    h.ema = em = { dir: d, x: x0, alvo: Math.max(16 * p, Math.min(W - 16 * p, h.x - d * 22 * p)), fase: 'entra', f: 0, andar: 0, hx: 0, hy: 0, bico: 0, andando: true, dir0: dir0 };
                    h.vx = 0;
                }
                d = em.dir; em.f++; rx = em.x + d * 17 * p; ry = y - 50 * p;
                if (!em.rondou && em.fase === 'entra' && em.f === 1 && h.y < H - 3) { em.fase = 'ronda'; em.rondou = true; em.esp = 0; em.andando = true; em.dir = em.dir0 || em.dir; d = em.dir; }
                if (em.fase === 'ronda') { // o boneco está no alto (em cima de um bloco): a ema ronda fora da tela até ele descer ao piso
                    if (em.esp > 0) {
                        em.esp--;
                        if (em.esp === 0) {
                            if (h.y >= H - 3) { d = h.x > W / 2 ? 1 : -1; em.dir = d; em.x = d > 0 ? -34 * p : W + 34 * p; em.alvo = Math.max(16 * p, Math.min(W - 16 * p, h.x - d * 22 * p)); em.fase = 'entra'; em.f = 0; }
                            else em.dir = -em.dir;
                        }
                        return;
                    }
                    em.x += em.dir * VEL * 2.4; em.andar++; em.hx = em.x + em.dir * 17 * p; em.hy = ry + Math.cos(em.andar * 0.8) * p; em.bico = 0;
                    if (em.x < -40 * p || em.x > W + 40 * p) em.esp = 40;
                    desenharEma(em, y, null, false, null);
                    return;
                }
                if (em.fase === 'entra') {
                    em.x += d * VEL * 2.7; em.andar++; em.hx = em.x + d * 17 * p + Math.sin(em.andar * 0.4) * p; em.hy = ry + Math.cos(em.andar * 0.8) * p;
                    if ((d > 0 && em.x >= em.alvo) || (d < 0 && em.x <= em.alvo)) { em.x = em.alvo; em.fase = 'olha'; em.f = 0; em.andando = false; }
                } else if (em.fase === 'olha') {
                    em.hx = rx; em.hy = ry + Math.sin(em.f * 0.5) * p; em.bico = 0;
                    if (em.f >= 14) { em.fase = 'bota'; em.f = 0; }
                } else if (em.fase === 'bota') { // dá o bote na cabeça do senhor
                    u = suave(em.f / 10); em.hx = rx + (vhx - rx) * u; em.hy = ry + (vhy - ry) * u; em.bico = u > 0.5 ? 1 : 0.3;
                    if (em.f >= 10) { // arrancou: o corpo fica sem cabeça
                        h.estado = 'morto'; h.vx = 0; h.boom = true; h.tFim = agora; j.cabecas++; h.semCabeca = true;
                        for (k = 0; k < 30; k++) h.sang.push({ x: h.x, y: h.y - BH * 0.85, vx: (Math.random() - 0.5) * p * 2.5, vy: -Math.random() * p * 3, v: 35 + Math.random() * 30, c: '#b00000', s: Math.max(2, p) });
                        em.fase = 'come'; em.f = 0;
                    }
                } else if (em.fase === 'come') { // levanta o pescoço com a cabeça no bico e mastiga
                    u = suave(em.f / 16); em.hx = vhx + (rx - vhx) * u; em.hy = vhy + (ry - vhy) * u;
                    em.bico = em.f > 16 ? 0.5 + 0.5 * Math.sin(em.f * 1.4) : 0.2; em.rotc = Math.sin(em.f * 0.7) * 0.4 * d;
                    if (em.f > 16) em.hy += Math.sin(em.f * 1.4) * 1.2 * p;
                    if (em.f < 14) for (k = 0; k < 2; k++) h.sang.push({ x: h.x, y: h.y - BH * 0.85, vx: (Math.random() - 0.5) * p, vy: -Math.random() * p * 2, v: 25, c: '#b00000', s: Math.max(2, p) });
                    if (em.f >= 52) { em.fase = 'engole'; em.f = 0; }
                } else if (em.fase === 'engole') { // a cabeça desce pelo pescoço
                    em.hx = rx; em.hy = ry + Math.sin(em.f * 0.9) * 1.2 * p; em.bico = 0.4 + 0.4 * Math.sin(em.f * 0.9);
                    if (em.f >= 32) { em.fase = 'cospe'; em.f = 0; }
                } else if (em.fase === 'cospe') { // engasga, joga o pescoço para trás e cospe a cabeça
                    if (em.f < 10) { u = suave(em.f / 10); em.hx = rx - d * 6 * p * u; em.hy = ry - 4 * p * u; em.bico = 0.2; }
                    else { u = suave((em.f - 10) / 6); em.hx = rx - d * 6 * p + (d * 22 * p) * u; em.hy = ry - 4 * p + 10 * p * u; em.bico = 1; }
                    if (em.f === 14) {
                        h.cab = { x: em.hx + d * 6 * p, y: em.hy, vx: d * p * 1.3, vy: -velPulo(altura * 0.45), rot: 0 };
                        for (k = 0; k < 16; k++) h.sang.push({ x: em.hx + d * 6 * p, y: em.hy, vx: d * (0.5 + Math.random()) * p * 1.4, vy: (Math.random() - 0.6) * p * 2, v: 25 + Math.random() * 20, c: k % 2 ? '#b9e769' : '#d9f09a', s: Math.max(2, p) });
                    }
                    if (em.f >= 30) { em.fase = 'espera'; em.f = 0; }
                } else if (em.fase === 'espera') {
                    em.hx = rx; em.hy = ry + Math.sin(em.f * 0.3) * p; em.bico = 0;
                    if (em.f >= 45) { em.fase = 'sai'; em.f = 0; em.dir = -d; em.andando = true; }
                } else { // vai embora correndo
                    d = em.dir; em.x += d * VEL * 2.7; em.andar++; em.hx = em.x + d * 17 * p; em.hy = ry + Math.cos(em.andar * 0.8) * p; em.bico = 0;
                    if (em.x < -40 * p || em.x > W + 40 * p) { h.acabou = true; h.ema = null; return; }
                }
                if (em.fase === 'come' || em.fase === 'engole' || em.fase === 'cospe') { if (h.tomba < 1.5) h.tomba += 0.04; }
                if (em.fase !== 'entra' && em.fase !== 'olha' && em.fase !== 'bota' && h.tomba < 1.5 && em.fase !== 'cospe' && em.fase !== 'come' && em.fase !== 'engole') h.tomba += 0.04;
                desenharEma(em, y, null, em.fase === 'come', em.fase === 'engole' ? em.f / 32 : null);
                if (ft > 1200) h.acabou = true;
            }

            // ---------- ema que foge do senhor grisalho: anda pela página, briga com todo mundo que cruza, mas não morre ----------
            function criarEmaR() {
                var d = Math.random() < 0.5 ? 1 : -1;
                j.emaR = { x: d > 0 ? W * 0.7 : W * 0.3, dir: d, andar: 0, hx: 0, hy: 0, bico: 0, andando: true, pausa: 0, cdb: 0 };
            }
            function passoEmaR() {
                var em = j.emaR, q, o, jx = 0;
                if (!em) return;
                em.andar++; if (em.cdb > 0) em.cdb--;
                if (em.pausa > 0) { em.pausa--; jx = (Math.random() - 0.5) * 3; em.andar += 2; }
                else {
                    for (q = 0; q < j.hs.length; q++) { // cruzou com alguém: confusão
                        o = j.hs[q];
                        if (!(j.nuvem && j.nuvem.t > 0) && o.tipo !== 4 && o.estado === 'vivo' && o.fase === 0 && !(o.cd > 0) && !(em.cdb > 0) && Math.abs(o.x - em.x) < BW * 1.4 && o.y > H - BH * 1.5) {
                            o.briga = 90; o.cd = 300; em.pausa = 90; em.cdb = 300; o.vx = (o.x >= em.x ? 1 : -1) * VEL * 1.6; em.dir = o.x >= em.x ? -1 : 1;
                            j.nuvem = { x: (o.x + em.x) / 2, y: H - BH * 0.8, t: 90, par: [o, em] }; break;
                        }
                    }
                    if (em.pausa <= 0) {
                        em.x += em.dir * VEL * 1.15;
                        if (em.x < 14 * p) { em.x = 14 * p; em.dir = 1; } if (em.x > W - 14 * p) { em.x = W - 14 * p; em.dir = -1; }
                        if (Math.random() < 0.004) em.dir = -em.dir;
                    }
                }
                em.hx = em.x + em.dir * 17 * p; em.hy = H - 50 * p + Math.cos(em.andar * 0.8) * p;
                g.save(); g.translate(jx, 0); desenharEma(em, H, null, false, null); g.restore();
            }
            function passoHeroi() {
                var h = j.heroi, v = j.vil, agora = Date.now(), sd;
                if (!h && j.heroiLib && agora >= (j.heroiQuando || 0)) { h = j.heroi = novoHeroi(); }
                if (h) {
                    h.t++;
                    if (h.cd > 0) h.cd--;
                    if (h.estado === 'voa' && h.fb > 0) {   // briga no ar: desce até o outro, troca socos e depois cada um foge para um lado
                        h.fb--; h.dir = h.lutaDir; h.y += (h.lutaY - h.y) * 0.15;
                        if (h.fb === 0) { h.vx = -h.lutaDir * VEL * 1.6; h.dir = h.vx >= 0 ? 1 : -1; }
                    } else if (h.estado === 'voa') {
                        var oq, ob;
                        if (!(h.cd > 0) && !(j.nuvem && j.nuvem.t > 0)) for (oq = 0; oq < j.hs.length; oq++) {
                            ob = j.hs[oq];
                            if (ob.estado === 'vivo' && ob.fase === 0 && !(ob.cd > 0) && Math.abs(ob.x - h.x) < BW * 1.5) {
                                h.fb = 90; h.cd = ob.cd = 300; ob.briga = 90; h.lutaDir = ob.x >= h.x ? 1 : -1; h.lutaY = ob.y - BH * 1.3;
                                ob.vx = -h.lutaDir * VEL * 1.6; j.nuvem = { x: (ob.x + h.x) / 2, y: ob.y - BH * 0.9, t: 90, par: [ob, h] };
                                break;
                            }
                        }
                    }
                    if (h.estado === 'voa' && !(h.fb > 0)) {
                        h.x += h.vx;
                        if (h.x < BW) { h.x = BW; h.vx = Math.abs(h.vx); } if (h.x > W - BW) { h.x = W - BW; h.vx = -Math.abs(h.vx); }
                        if (Math.random() < 0.004) h.vx = -h.vx;
                        h.dir = h.vx >= 0 ? 1 : -1;
                        h.y += ((H * 0.28 + Math.sin(h.t * 0.021) * H * 0.14 + Math.sin(h.t * 0.07) * p * 2) - h.y) * 0.05;
                    } else if (h.estado === 'alvo') { h.y += Math.sin(h.t * 0.2) * p * 0.2; }
                    else if (h.estado === 'choque') { h.ft++; if (h.ft >= 80) { h.estado = 'cai'; h.vy = 0; } }
                    else if (h.estado === 'cai') {
                        h.vy += GRAV; h.y += h.vy;
                        if (h.y >= H - 4 * p) { h.y = H - 4 * p; h.estado = 'morto'; h.tm = agora; j.cabecas++; }
                    } else if (h.estado === 'morto' && agora - h.tm >= 2200) {
                        j.heroi = null; j.heroiQuando = agora + 3000; if (v) v.fase = 'sai'; h = null;
                    }
                    if (h) { desenharHeroi(h); if (h.estado === 'choque') raios(h.x, h.y - 2 * p); }
                }
                if (v) {
                    v.ft++;
                    if (v.fase === 'morto') { if (agora - v.tm >= 2200) { j.vil = null; if (h && h.estado === 'alvo') h.estado = 'voa'; v = null; } }
                    else {
                    if (h && (h.estado === 'alvo' || h.estado === 'choque' || h.estado === 'cai')) { v.hx = h.x; v.hy = h.y - 2 * p; }
                    if ((v.fase === 'entra' || v.fase === 'sai') && v.pausa > 0) { v.pausa--; }
                    else if (v.fase === 'entra' || v.fase === 'sai') {
                        var oc;
                        for (oc = 0; oc < j.hs.length; oc++) { // cruzou com um personagem pelo caminho: briga
                            var ov2 = j.hs[oc];
                            if (!(j.nuvem && j.nuvem.t > 0) && ov2.estado === 'vivo' && ov2.fase === 0 && !(ov2.cd > 0) && !(v.cdb > 0) && Math.abs(ov2.x - v.x) < BW * 1.3 && ov2.y > H - BH * 1.5) {
                                ov2.briga = 90; ov2.cd = 300; v.pausa = 90; v.cdb = 300; ov2.vx = (ov2.x >= v.x ? 1 : -1) * VEL * 1.6;
                                j.nuvem = { x: (ov2.x + v.x) / 2, y: H - BH * 0.5, t: 90, par: [ov2, v] }; break;
                            }
                        }
                    }
                    if (v.cdb > 0) v.cdb--;
                    if (v.pausa > 0) { /* brigando */ }
                    else if (v.fase === 'entra') {
                        sd = v.x < v.alvoX ? 1 : -1; v.dir = sd; v.x += sd * VEL * 1.5; v.andar++;
                        if (Math.abs(v.x - v.alvoX) <= VEL * 1.6) { v.fase = 'mira'; v.ft = 0; }
                    } else if (v.fase === 'sai') {
                        sd = v.x < W / 2 ? -1 : 1; v.dir = sd; v.x += sd * VEL * 1.5; v.andar++;
                        if (v.x < -BW * 3 || v.x > W + BW * 3) { j.vil = null; v = null; }
                    } else {
                        if (h) v.dir = h.x >= v.x ? 1 : -1;
                        if (v.fase === 'mira' && v.ft >= 25) { v.fase = 'tiro'; v.ft = 0; }
                        else if (v.fase === 'tiro') {
                            var u = Math.min(1, v.ft / 14), bx = v.mx + (v.hx - v.mx) * u, by = v.my + (v.hy - v.my) * u;
                            fioTaser(v.mx, v.my, bx, by, false);
                            g.fillStyle = '#facc15'; g.beginPath(); g.arc(bx, by, Math.max(2, p * 0.8), 0, 6.2832, false); g.fill();
                            if (u >= 1 && h) { h.estado = 'choque'; h.ft = 0; v.fase = 'choque'; v.ft = 0; }
                        } else if (v.fase === 'choque') {
                            if (h && h.estado === 'choque') { fioTaser(v.mx, v.my, v.hx, v.hy, true); }
                            else { v.fase = 'espera'; }
                        }
                    }
                    }
                    if (v) desenharVilao(v);
                }
            }
            function passo() {
                var k, hi, h, a2, b2;
                g.clearRect(0, 0, W, H);
                if (segs.length) g.drawImage(lay, 0, j.desY || 0);
                quadro++;
                if (quadro % 20 === 0) { lerObstaculos(); lerIndio(); }
                passoBlocos();
                var puxaI = 0, dirI = indioPos.x < W / 2 ? 1 : -1, pi2;
                for (pi2 = 0; pi2 < j.hs.length; pi2++) {
                    var hq = j.hs[pi2];
                    if (hq.morte === 'flecha' && !hq.acabou) { dirI = hq.x >= indioPos.x ? 1 : -1; hq.dirI = dirI; if (hq.ft < 26) puxaI = Math.max(puxaI, hq.ft / 26); else if (hq.ft < 28) puxaI = 1; }
                }
                desenharIndio(puxaI, dirI);
                var dec = Date.now() - j.t0, quando = [0, 1000, 3000, 5000], ordem = [4, 0, 1, 2];   // o senhor grisalho já começa o jogo correndo atrás da ema; depois 1 s, 3 s e 5 s
                while (j.hs.length < 4 && dec >= quando[j.hs.length]) { var nn = novo(ordem[j.hs.length]); nasceNaComanda(nn); j.hs.push(nn); if (nn.tipo === 4) criarEmaR(); }
                for (a2 = 0; a2 < j.hs.length; a2++) for (b2 = a2 + 1; b2 < j.hs.length; b2++) {
                    if (j.hs[a2].estado === 'vivo' && j.hs[b2].estado === 'vivo' && j.hs[a2].fase === 0 && j.hs[b2].fase === 0) checarBriga(j.hs[a2], j.hs[b2]);
                }
                juntarBriga();
                if (j.nuvem && j.nuvem.t > 0) { desenharBriga(); }
                passoFumaca();
                if (j.carr && j.carr.saindo) { // o carrasco só some da página depois de sair andando
                    var cc = j.carr, sdc = cc.x < W / 2 ? -1 : 1; cc.x += sdc * VEL * 1.5; cc.dir = sdc; cc.andar++; cc.solo = true; humano(cc);
                    if (cc.x < -BW * 2 || cc.x > W + BW * 2) j.carr = null;
                }
                for (hi = 0; hi < j.hs.length; hi++) {
                    h = j.hs[hi];
                    if (h.estado === 'vivo') { if (h.briga > 0) { h.briga--; cairParado(h); } else { if (h.tipo === 4 && j.emaR) { var dxe = j.emaR.x - h.x; h.vx = Math.abs(dxe) < BW * 1.4 ? 0 : (dxe > 0 ? 1 : -1) * VEL * 1.05; if (h.vx !== 0) h.dir = h.vx > 0 ? 1 : -1; } mover(h); if (h.rasteja && h.solo && h.y < H - BH * 3.5) { h.presoT = (h.presoT || 0) + 1; if (h.presoT > 300) { nasceNaComanda(h); h.presoT = 0; } } else h.presoT = 0; } }
                    else if (h.estado === 'abduzido') { /* flutuando */ }
                    else if (h.estado === 'parado') { var ya = h.y; h.vy += GRAV; h.y += h.vy; var op = bate(h.x, h.y); if (h.y >= H || op) { h.y = op ? op.t : H; h.vy = 0; } else pousarNoDesenho(h, ya); }
                    else {
                        h.t++;
                        var yb = h.y; h.vy += GRAV; h.y += h.vy; if (h.y >= H || bate(h.x, h.y)) { var oo = bate(h.x, h.y); h.y = oo ? oo.t : H; h.vy = 0; } else pousarNoDesenho(h, yb);
                        if (h.cab) { h.cab.x += h.cab.vx; h.cab.y += h.cab.vy; h.cab.vy += GRAV; h.cab.rot += 0.3; if (h.cab.y > H - 4 * p) { h.cab.y = H - 4 * p; h.cab.vy = -h.cab.vy * 0.4; h.cab.vx *= 0.7; } }
                    }
                    humano(h);
                    if (h.fase >= 1 && !h.acabou) { if (h.morte === 'ferramentas' || h.morte === 'foice' || h.morte === 'martelo') animarFerramentas(h); else animarMorte(h); }
                    if (h.acabou) { // ressurge 1 s depois, para poder ser morto de novo
                        if (!h.renasce) { h.renasce = Date.now(); if ((h.morte === 'ferramentas' || h.morte === 'foice' || h.morte === 'martelo') && ic) ic.style.visibility = 'visible'; }
                        else if (Date.now() - h.renasce >= 1000) { var nv = novo(h.tipo); nv.mortes = h.mortes + 1; nv.estagio = h.estagio; nv.jc = h.jc; nv.gc = h.gc; nv.forma = h.forma;
                            if (h.tipo === 0) { // 1º: humano → (vacina) jacaré → gado (disco voador, lhama) → patriota → volta a humano
                                if (h.estagio === 0) { nv.estagio = 1; nv.forma = 'humano'; }
                                else if (h.estagio === 2) { nv.jc = h.jc + 1; if (nv.jc >= 3) { nv.estagio = 3; nv.forma = 'boi'; nv.gc = 0; } }
                                else if (h.estagio === 4) { nv.estagio = 0; nv.jc = 0; nv.gc = 0; nv.forma = 'humano'; }   // o patriota morre e reinicia o ciclo
                            }
                            aplicarForma(nv); nasceNaComanda(nv); j.hs[hi] = nv; if (nv.tipo === 4) criarEmaR(); continue; }
                    }
                    if (h.cab) {
                        g.save(); g.translate(h.cab.x, h.cab.y); g.rotate(h.cab.rot); g.translate(-h.cab.x, -h.cab.y);
                        cabeca(h.cab.x, h.cab.y, h.dir, h.tipo);
                        g.restore();
                    }
                    if (h.estado === 'corte' && h.t > 10) h.estado = 'morto';
                    for (k = h.sang.length - 1; k >= 0; k--) {
                        var sg = h.sang[k]; sg.x += sg.vx; sg.y += sg.vy; sg.vy += GRAV * 0.8; sg.v--;
                        g.fillStyle = sg.c || '#b00000'; g.fillRect(sg.x, sg.y, sg.s || Math.max(2, p), sg.s || Math.max(2, p));
                        if (sg.v <= 0) h.sang.splice(k, 1);
                    }
                }
                passoHeroi();
                passoEmaR();
                g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif'; g.textAlign = 'left';
                g.fillText('Mortes: ' + j.cabecas, 10, H - 10);
                g.textAlign = 'right'; g.font = '11px sans-serif';
                g.fillText('desenhe  •  botão direito ou 2 dedos apagam  •  toque nos bonecos  •  4 toques rápidos para sair', W - 10, H - 10);
                g.textAlign = 'left'; g.fillText('[ limpar desenho ]', 190, H - 10);
                if (!j.fim) j.raf = (window.requestAnimationFrame || function(f) { return setTimeout(f, 33); })(passo);
            }
            function acertou(px, py) {
                var q, h;
                for (q = j.hs.length - 1; q >= 0; q--) {
                    h = j.hs[q];
                    var alt = h.rasteja ? (h.forma === 'boi' ? 10 * p : 6 * p) : BH + p * 3, lar = h.rasteja ? BW * 1.5 : BW * 1.1;
                    if (h.fase === 0 && h.estado === 'vivo' && !h.condenado && Math.abs(px - h.x) < lar && py > h.y - alt && py < h.y + p * 3) return h;
                }
                return null;
            }
            function toqueCurto(px, py) { // toque rápido (sem arrastar): conta para sair
                var agora = Date.now();
                j.toques = j.toques.filter(function(t) { return agora - t < 2000; });
                j.toques.push(agora);
                if (j.toques.length >= 4) sairGame();
            }
            var cur = null, multi = false;
            function limparTudo() { segs = []; lg.clearRect(0, 0, W, H); cur = null; }
            function descer(px, py) {
                if (px > 170 && px < 330 && py > H - 26) { limparTudo(); return; } // [ limpar desenho ]
                var nu = j.nuvem;
                var he = j.heroi;
                if (he && he.estado === 'voa' && !he.condenado && Math.abs(px - he.x) < BW * 1.7 && Math.abs(py - he.y) < BH * 1.2) { matarHeroi(); j.toques = []; return; }
                var hit = acertou(px, py);
                if (hit) {
                    var h = hit;
                    h.estado = 'parado'; h.vx = 0; h.fase = 1; h.ft = 0; j.toques = [];
                    h.morte = escolherMorte(h);
                    if (ic && (h.morte === 'ferramentas' || h.morte === 'foice' || h.morte === 'martelo')) ic.style.visibility = 'hidden'; // o ícone ☭ do topo se separa e vai até o boneco
                    return;
                }
                cur = { x0: px, y0: py, ult: { x: px, y: py }, len: 0, n: 0, t0: Date.now() };
            }
            function mover2(px, py) {
                if (!cur) return;
                var dx = px - cur.ult.x, dy = py - cur.ult.y, d = Math.sqrt(dx * dx + dy * dy);
                if (d < 6) return;
                if (segs.length > 2500) return;
                segs.push({ x1: cur.ult.x, y1: cur.ult.y, x2: px, y2: py });
                riscar(cur.ult.x, cur.ult.y, px, py);
                cur.len += d; cur.n++; cur.ult = { x: px, y: py };
            }
            function subir(px, py) {
                if (!cur) return;
                var c = cur; cur = null;
                if (c.len < 14) { // foi só um toque: apaga o risquinho e conta como toque de saída
                    if (c.n) { segs.splice(segs.length - c.n, c.n); redesenharCamada(); }
                    toqueCurto(px, py);
                }
            }
            function pos(e) { var t = (e.changedTouches && e.changedTouches[0]) || e, r = el.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; }
            var porToque = false;
            el.addEventListener('touchstart', function(e) {
                e.preventDefault(); porToque = true;
                if (e.touches && e.touches.length >= 2) { multi = true; limparTudo(); return; }   // 2 dedos: apaga o desenho
                if (multi) return;
                var q = pos(e); descer(q.x, q.y);
            }, false);
            el.addEventListener('touchmove', function(e) { e.preventDefault(); if (multi) return; var q = pos(e); mover2(q.x, q.y); }, false);
            el.addEventListener('touchend', function(e) {
                e.preventDefault();
                if (multi) { if (!e.touches || e.touches.length === 0) multi = false; return; }
                var q = pos(e); subir(q.x, q.y);
            }, false);
            el.addEventListener('contextmenu', function(e) { e.preventDefault(); }, false);
            el.addEventListener('mousedown', function(e) {
                if (porToque) return;
                if (e.button === 2) { limparTudo(); return; }   // botão direito: apaga o desenho
                var q = pos(e); descer(q.x, q.y);
            }, false);
            el.addEventListener('mousemove', function(e) { if (porToque) return; var q = pos(e); mover2(q.x, q.y); }, false);
            el.addEventListener('mouseup', function(e) { if (porToque) { porToque = false; return; } if (e.button === 2) return; var q = pos(e); subir(q.x, q.y); }, false);
            passo();
        }
        function sairGame() {
            if (!jogo) return;
            jogo.fim = true;
            try { if (window.cancelAnimationFrame) window.cancelAnimationFrame(jogo.raf); } catch (e) {}
            if (jogo.ic) jogo.ic.style.visibility = 'visible';
            if (jogo.queda) { // a página volta ao normal
                var fq = jogo.queda, w;
                for (w = 0; w < fq.length; w++) { fq[w].el.style.webkitTransition = fq[w].el.style.transition = 'transform 0.4s'; fq[w].el.style.webkitTransform = fq[w].el.style.transform = ''; }
                setTimeout(function() { for (var z = 0; z < fq.length; z++) { fq[z].el.style.webkitTransition = fq[z].el.style.transition = ''; fq[z].el.style.webkitTransformOrigin = fq[z].el.style.transformOrigin = ''; } }, 500);
            }
            if (jogo.el && jogo.el.parentNode) jogo.el.parentNode.removeChild(jogo.el);
            jogo = null;
            renderizar();
        }

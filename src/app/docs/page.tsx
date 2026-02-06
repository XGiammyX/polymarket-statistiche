"use client";

import Navbar from "@/components/Navbar";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-3">Come funziona</h1>
          <p className="text-gray-400 leading-relaxed">
            Guida completa al funzionamento della piattaforma, agli indicatori statistici
            e alle strategie di analisi dei wallet su Polymarket.
          </p>
        </div>

        {/* Table of contents */}
        <nav className="mb-10 bg-gray-900/60 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Indice</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
            {[
              { id: "come-usare", label: "★ Come sfruttare i dati" },
              { id: "workflow", label: "★ Workflow pratico passo-passo" },
              { id: "leggere-tabella", label: "★ Come leggere la tabella" },
              { id: "idea", label: "1. L'idea di base" },
              { id: "pipeline", label: "2. Pipeline dati (ETL)" },
              { id: "alpha", label: "3. Alpha-Z: il cuore statistico" },
              { id: "follow-score", label: "4. Follow Score" },
              { id: "followable", label: "5. Criteri \"Followable\"" },
              { id: "leaderboard", label: "6. Pagina Leaderboard" },
              { id: "signals", label: "7. Pagina Segnali Live" },
              { id: "positions", label: "8. Pagina Posizioni Aperte" },
              { id: "wallet", label: "9. Dettaglio Wallet" },
              { id: "filtri", label: "10. Guida ai filtri" },
              { id: "limiti", label: "11. Limiti e avvertenze" },
              { id: "tech", label: "12. Stack tecnico" },
            ].map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-blue-400 hover:underline">{item.label}</a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="space-y-12 text-sm leading-relaxed text-gray-300">

          {/* ★ Come sfruttare i dati */}
          <section id="come-usare">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-yellow-400">★</span> Come sfruttare i dati per scommettere
            </h2>
            <p className="mb-4">
              Questa piattaforma identifica wallet che hanno un <strong className="text-white">vantaggio informativo dimostrabile</strong> su
              Polymarket. Ecco come puoi usarla concretamente:
            </p>

            <div className="space-y-4">
              <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-4">
                <h3 className="text-blue-400 font-semibold mb-2">Strategia 1: Copy-trading dai Segnali Live</h3>
                <p className="text-gray-400 text-xs mb-2">
                  Vai alla pagina <strong className="text-white">Segnali</strong> e cerca trade recenti di wallet followable.
                  Se un wallet con Alpha-Z &gt; 2 ha appena comprato un token a $0.01, quel mercato potrebbe
                  avere una probabilità reale più alta di quello che il mercato crede.
                </p>
                <div className="bg-gray-900/60 rounded p-3 text-xs text-gray-500 mt-2">
                  <strong className="text-gray-300">Esempio concreto:</strong> Wallet 0xca85... (αZ +2.55 a soglia 1%) compra
                  &quot;Solana Up or Down&quot; a $0.01 (il mercato dice 1% di probabilità). Se vince, il payout è $1 per
                  token — rendimento 100x. Il fatto che questo wallet abbia storicamente vinto più del caso
                  suggerisce che potrebbe avere un edge anche su questo trade.
                </div>
              </div>

              <div className="bg-purple-950/30 border border-purple-800/50 rounded-lg p-4">
                <h3 className="text-purple-400 font-semibold mb-2">Strategia 2: Monitorare le Posizioni Aperte</h3>
                <p className="text-gray-400 text-xs mb-2">
                  La pagina <strong className="text-white">Posizioni</strong> mostra dove i wallet migliori hanno ancora shares in mano.
                  Se un wallet followable ha una posizione aperta su un mercato, significa che <strong className="text-white">non ha ancora venduto</strong> —
                  crede ancora nell&apos;esito. Puoi comprare lo stesso token finché il prezzo è ancora basso.
                </p>
                <div className="bg-gray-900/60 rounded p-3 text-xs text-gray-500 mt-2">
                  <strong className="text-gray-300">Quando NON copiare:</strong> Se il prezzo corrente è già salito molto
                  rispetto all&apos;entry price del wallet, il rischio/rendimento potrebbe non essere più conveniente.
                  Cerca segnali dove il prezzo è ancora vicino all&apos;entry.
                </div>
              </div>

              <div className="bg-green-950/30 border border-green-800/50 rounded-lg p-4">
                <h3 className="text-green-400 font-semibold mb-2">Strategia 3: Analisi del Wallet Detail</h3>
                <p className="text-gray-400 text-xs mb-2">
                  Clicca su un wallet nella leaderboard per vedere il suo profilo completo. Controlla:
                </p>
                <ul className="text-xs text-gray-400 space-y-1 ml-3">
                  <li>→ <strong className="text-white">Stats a 3 soglie</strong>: se αZ è alto a tutte le soglie (5%, 2%, 1%), l&apos;edge è robusto</li>
                  <li>→ <strong className="text-white">Upset Wins</strong>: i mercati specifici dove ha vinto — ti dice in che tipo di mercati è bravo</li>
                  <li>→ <strong className="text-white">Trade recenti</strong>: cosa sta comprando ORA, anche su mercati non ancora risolti</li>
                  <li>→ <strong className="text-white">Hedge Rate = 0%</strong>: il wallet non copre mai → le sue scommesse sono genuine</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ★ Workflow pratico */}
          <section id="workflow">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-yellow-400">★</span> Workflow pratico passo-passo
            </h2>

            <div className="space-y-3">
              {[
                {
                  num: "1",
                  title: "Apri la Leaderboard",
                  desc: "Imposta Soglia ≤2%, Min N = 5+, ordina per Score. Cerca wallet con Win% verde (sopra E[W%]) e ROI positivo.",
                  color: "text-blue-400",
                },
                {
                  num: "2",
                  title: "Analizza i top wallet",
                  desc: "Clicca sul wallet per vedere il dettaglio. Controlla che αZ sia positivo a più soglie e che Hedge Rate sia 0%. Guarda gli Upset Wins per capire su che mercati è forte.",
                  color: "text-blue-400",
                },
                {
                  num: "3",
                  title: "Controlla i Segnali Live",
                  desc: "Vai in Segnali e filtra per 'Solo Followable'. Cerca trade con entry price basso su mercati che ti interessano. Clicca 'Polymarket ↗' per andare direttamente al mercato.",
                  color: "text-blue-400",
                },
                {
                  num: "4",
                  title: "Valuta il rischio/rendimento",
                  desc: "Entry a $0.02 = rischi $0.02 per token, guadagni $0.98 se vince. Ma la probabilità reale è bassa. Usa una size piccola (1-5% del bankroll) per ogni scommessa copiata.",
                  color: "text-yellow-400",
                },
                {
                  num: "5",
                  title: "Diversifica",
                  desc: "Non copiare un solo wallet o un solo mercato. Segui più wallet followable su più mercati diversi. La forza statistica viene dal volume.",
                  color: "text-yellow-400",
                },
                {
                  num: "6",
                  title: "Monitora le Posizioni",
                  desc: "Tieni d'occhio la pagina Posizioni. Se un wallet vende le sue shares (posizione scompare), potrebbe essere un segnale per uscire anche tu.",
                  color: "text-green-400",
                },
              ].map((s) => (
                <div key={s.num} className="flex gap-3 bg-gray-900/60 rounded-lg p-4 border border-gray-800">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center font-bold text-sm ${s.color}`}>
                    {s.num}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{s.title}</h3>
                    <p className="text-gray-400 text-xs mt-1">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 bg-yellow-950/30 border border-yellow-800/50 rounded-lg p-4">
              <h3 className="text-yellow-400 font-semibold text-sm mb-1">Regola d&apos;oro del bankroll</h3>
              <p className="text-gray-400 text-xs">
                Le scommesse low-prob vincono raramente ma pagano molto. Non mettere mai più dell&apos;1-2%
                del tuo bankroll su una singola scommessa copiata. Su 50 trade a $0.02, ne vincerai forse 1-3,
                ma ognuno paga 50x. Il profitto viene dalla <strong className="text-white">legge dei grandi numeri</strong>.
              </p>
            </div>
          </section>

          {/* ★ Come leggere la tabella */}
          <section id="leggere-tabella">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-yellow-400">★</span> Come leggere la tabella — riga per riga
            </h2>
            <p className="mb-4">
              Ecco come interpretare una riga della leaderboard per decidere se seguire un wallet:
            </p>

            <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-5 mb-4">
              <p className="text-gray-400 text-xs mb-3">Esempio di riga:</p>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="py-1 px-2 text-left">Wallet</th>
                      <th className="py-1 px-2 text-right">Score</th>
                      <th className="py-1 px-2 text-right">N/W</th>
                      <th className="py-1 px-2 text-right">Win%</th>
                      <th className="py-1 px-2 text-right">E[W%]</th>
                      <th className="py-1 px-2 text-right">αZ</th>
                      <th className="py-1 px-2 text-right">ROI</th>
                      <th className="py-1 px-2 text-right">H/L%</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-green-950/20">
                      <td className="py-1.5 px-2 font-mono text-blue-400">0xca85…bf2 ✓</td>
                      <td className="py-1.5 px-2 text-right font-bold text-blue-400">0.7</td>
                      <td className="py-1.5 px-2 text-right">31/<span className="text-green-400 font-bold">1</span></td>
                      <td className="py-1.5 px-2 text-right text-green-400 font-bold">3.2%</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">1.6%</td>
                      <td className="py-1.5 px-2 text-right text-green-400 font-bold">+0.7</td>
                      <td className="py-1.5 px-2 text-right text-green-400 font-bold">+100%</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">0/0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <strong className="text-white text-sm">N/W = 31/1</strong>
                <p className="text-gray-400 text-xs mt-1">
                  Ha fatto 31 trade a bassa probabilità (≤2%). Di questi, 1 ha vinto.
                  Sembra poco? Con prezzi medi di ~1.6%, statisticamente ci aspetteremmo ~0.5 vittorie.
                  Ne ha avuta 1 — il doppio del previsto.
                </p>
              </div>
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <strong className="text-green-400 text-sm">Win% = 3.2% vs E[W%] = 1.6%</strong>
                <p className="text-gray-400 text-xs mt-1">
                  Win% è la percentuale di vittorie reali (1/31 = 3.2%).
                  E[W%] è quello che il caso prevederebbe (1.6%).
                  <strong className="text-white"> Win% &gt; E[W%]</strong> → questo wallet vince il doppio del caso. Se Win% è <strong className="text-green-400">verde</strong>, c&apos;è un edge.
                </p>
              </div>
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <strong className="text-green-400 text-sm">αZ = +0.7</strong>
                <p className="text-gray-400 text-xs mt-1">
                  Positivo = sopra la media. Ma &lt;2, quindi potrebbe essere fortuna con solo 31 trade.
                  Con più campione, se il pattern continua, αZ crescerà e diventerà statisticamente significativo.
                  <strong className="text-white"> αZ &gt; 2 = meno del 2.3% di probabilità che sia caso.</strong>
                </p>
              </div>
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <strong className="text-green-400 text-sm">ROI = +100%</strong>
                <p className="text-gray-400 text-xs mt-1">
                  Se avessi investito $1 per ogni trade di questo wallet, avresti speso in totale ~$0.50
                  (somma dei prezzi dei 31 token) e incassato $1.00 (la vittoria). Rendimento netto: +100%.
                  <strong className="text-white"> ROI positivo = profitto reale.</strong> ROI negativo = perdita.
                </p>
              </div>
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <strong className="text-white text-sm">H/L% = 0/0</strong>
                <p className="text-gray-400 text-xs mt-1">
                  Hedge 0% = non copre mai le scommesse (buono, segnale genuino).
                  Late 0% = non fa sniping last-minute (buono, non sfrutta info pubblica dell&apos;ultimo minuto).
                  <strong className="text-white"> Valori bassi = wallet più affidabile.</strong>
                </p>
              </div>
            </div>

            <div className="mt-4 bg-green-950/30 border border-green-800/50 rounded-lg p-4">
              <h3 className="text-green-400 font-semibold text-sm mb-2">Checklist rapida: quando copiare un wallet?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-400">
                <div className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                  <span><strong className="text-white">Win% verde</strong> (sopra E[W%])</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                  <span><strong className="text-white">αZ &gt; 0</strong> (idealmente &gt;2)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                  <span><strong className="text-white">ROI positivo</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                  <span><strong className="text-white">Hedge/Late bassi</strong> (0-25%)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                  <span><strong className="text-white">N ≥ 10+</strong> (campione minimo)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                  <span><strong className="text-white">Ultimo trade recente</strong> (wallet ancora attivo)</span>
                </div>
              </div>
            </div>
          </section>

          {/* 1 */}
          <section id="idea">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">1.</span> L&apos;idea di base
            </h2>
            <p className="mb-3">
              Su Polymarket, i mercati predittivi permettono di comprare token che pagano $1 se un evento
              si verifica. Un token che costa $0.02 implica una probabilità del 2% secondo il mercato.
            </p>
            <p className="mb-3">
              Se un wallet compra sistematicamente token a prezzi bassissimi (≤2%) e <strong className="text-white">vince più spesso
              di quanto il caso prevederebbe</strong>, potrebbe avere un vantaggio informativo. Questa piattaforma
              identifica questi wallet analizzando migliaia di trade storici.
            </p>
            <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-800">
              <p className="text-gray-400">
                <strong className="text-gray-200">Esempio:</strong> Un wallet compra 50 trade a prezzi ≤0.02.
                Statisticamente ci aspettiamo ~1 vittoria (50 × 0.02 = 1). Se ne vince 4, è molto improbabile
                per puro caso — l&apos;Alpha-Z misura esattamente quanto è improbabile.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section id="pipeline">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">2.</span> Pipeline dati (ETL)
            </h2>
            <p className="mb-3">
              Il sistema raccoglie dati automaticamente ogni 10 minuti attraverso una pipeline in 4 fasi:
            </p>
            <div className="grid gap-3">
              {[
                {
                  step: "A",
                  title: "Sync Markets",
                  source: "Gamma API",
                  desc: "Scarica tutti i mercati di Polymarket: domanda, outcomes, date, stato (aperto/chiuso). Li salva nella tabella markets.",
                },
                {
                  step: "B",
                  title: "Sync Resolutions",
                  source: "CLOB API",
                  desc: "Per ogni mercato chiuso, verifica quale outcome ha vinto. Salva il winning_token_id e winning_outcome_index nella tabella resolutions.",
                },
                {
                  step: "C",
                  title: "Sync Trades",
                  source: "Data API",
                  desc: "Per ogni mercato risolto con un vincitore, scarica tutti i trade BUY. Ogni trade include: wallet, prezzo, size, outcome scelto, timestamp.",
                },
                {
                  step: "D",
                  title: "Compute Stats",
                  source: "PostgreSQL",
                  desc: "Analizza tutti i trade scaricati, calcola Alpha-Z e Follow Score per ogni wallet, e aggiorna le classifiche.",
                },
              ].map((s) => (
                <div key={s.step} className="bg-gray-900/60 rounded-lg p-4 border border-gray-800 flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-sm">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{s.title} <span className="text-gray-500 font-normal text-xs">({s.source})</span></h3>
                    <p className="text-gray-400 mt-1">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-gray-500 text-xs">
              Ogni run ha un budget di 25 secondi per rispettare i limiti Vercel. Se il tempo non basta,
              riprende al prossimo ciclo da dove si era fermato.
            </p>
          </section>

          {/* 3 */}
          <section id="alpha">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">3.</span> Alpha-Z: il cuore statistico
            </h2>
            <p className="mb-3">
              L&apos;Alpha-Z è uno <strong className="text-white">z-score</strong> che misura quante deviazioni standard
              le vittorie di un wallet si discostano dal valore atteso. È l&apos;indicatore più importante della piattaforma.
            </p>

            <div className="bg-gray-900/80 rounded-lg p-5 border border-gray-800 font-mono text-center mb-4">
              <p className="text-gray-400 text-xs mb-2">Formula</p>
              <p className="text-lg text-white">
                Alpha-Z = (Wins − E[Wins]) / √Var
              </p>
              <div className="mt-3 text-xs text-gray-500 text-left space-y-1">
                <p><strong className="text-gray-300">Wins</strong> = numero di trade low-prob che hanno vinto</p>
                <p><strong className="text-gray-300">E[Wins]</strong> = Σ prezzo<sub>i</sub> — somma dei prezzi pagati (valore atteso)</p>
                <p><strong className="text-gray-300">Var</strong> = Σ prezzo<sub>i</sub> × (1 − prezzo<sub>i</sub>) — varianza binomiale</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <div className="text-green-400 font-bold text-lg mb-1">&gt; 2.0</div>
                <p className="text-gray-400 text-xs">Vantaggio statisticamente significativo. Probabilità &lt;2.3% che sia dovuto al caso.</p>
              </div>
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <div className="text-yellow-400 font-bold text-lg mb-1">0 — 2.0</div>
                <p className="text-gray-400 text-xs">Performance sopra la media ma potrebbe essere fortuna. Serve più campione.</p>
              </div>
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <div className="text-red-400 font-bold text-lg mb-1">&lt; 0</div>
                <p className="text-gray-400 text-xs">Performance sotto la media. Il wallet vince meno di quanto il caso prevederebbe.</p>
              </div>
            </div>
          </section>

          {/* 4 */}
          <section id="follow-score">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">4.</span> Follow Score
            </h2>
            <p className="mb-3">
              Punteggio composito 0-100 che combina più fattori per determinare quanto un wallet è
              &quot;affidabile da seguire&quot;. Più alto = meglio.
            </p>
            <div className="bg-gray-900/80 rounded-lg p-5 border border-gray-800 font-mono text-sm mb-4">
              <p className="text-gray-400 text-xs mb-2">Componenti del calcolo</p>
              <div className="space-y-2 text-gray-300">
                <p>100</p>
                <p>× <strong className="text-blue-400">min(N/50, 1)</strong> <span className="text-gray-500">— volume: più trade = più affidabile</span></p>
                <p>× <strong className="text-blue-400">min((αZ+1)/6, 1)</strong> <span className="text-gray-500">— performance statistica</span></p>
                <p>× <strong className="text-blue-400">(1 − hedge_rate)</strong> <span className="text-gray-500">— penalizza chi copre le scommesse</span></p>
                <p>× <strong className="text-blue-400">(1 − 0.5 × late_rate)</strong> <span className="text-gray-500">— penalizza sniping last-minute</span></p>
                <p>× <strong className="text-blue-400">e<sup>−ln2 × days/30</sup></strong> <span className="text-gray-500">— decadimento temporale (dimezza ogni 30 giorni)</span></p>
              </div>
            </div>
          </section>

          {/* 5 */}
          <section id="followable">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">5.</span> Criteri &quot;Followable&quot;
            </h2>
            <p className="mb-3">
              Un wallet viene marcato come <span className="text-green-400 font-medium">Followable ✓</span> solo se soddisfa
              <strong className="text-white"> tutti</strong> questi criteri contemporaneamente:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "N ≥ 20", desc: "Almeno 20 trade low-prob (≤2%) su mercati risolti. Serve un campione minimo per la significatività statistica." },
                { label: "Alpha-Z > 0", desc: "Performance sopra il caso. Il wallet vince più di quanto ci aspetteremmo dalla pura probabilità." },
                { label: "Hedge Rate ≤ 25%", desc: "In massimo il 25% dei mercati, il wallet scommette su entrambi i lati. Troppo hedging = non è un segnale reale." },
                { label: "Late Sniping ≤ 60%", desc: "Massimo il 60% dei trade piazzati nelle ultime 6 ore prima della chiusura. Troppo tardi = informazione pubblica." },
              ].map((c) => (
                <div key={c.label} className="bg-gray-900/60 rounded p-3 border border-gray-800">
                  <div className="text-white font-semibold font-mono text-sm mb-1">{c.label}</div>
                  <p className="text-gray-400 text-xs">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 6 */}
          <section id="leaderboard">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">6.</span> Pagina Leaderboard
            </h2>
            <p className="mb-3">
              Classifica di tutti i wallet analizzati, ordinati per Follow Score. Mostra le metriche chiave di ogni wallet.
            </p>
            <div className="overflow-auto">
              <table className="w-full text-xs border border-gray-800 rounded">
                <thead>
                  <tr className="bg-gray-900/80 text-gray-400">
                    <th className="py-2 px-3 text-left">Colonna</th>
                    <th className="py-2 px-3 text-left">Significato</th>
                  </tr>
                </thead>
                <tbody className="text-gray-400">
                  {[
                    ["Follow Score", "Punteggio composito 0-100. Combina Alpha-Z, volume, hedge rate, late rate e recency."],
                    ["Followable", "✓ se il wallet soddisfa tutti i criteri di qualità (vedi sezione 5)."],
                    ["N", "Numero totale di trade low-prob sotto la soglia selezionata su mercati risolti."],
                    ["Wins", "Quanti di quei trade hanno effettivamente vinto (outcome corretto)."],
                    ["E[Wins]", "Vittorie attese (somma dei prezzi pagati). Se Wins > E[Wins], il wallet ha un edge."],
                    ["Alpha-Z", "Z-score statistico. Verde se > 0 (sopra la media), rosso se < −1 (sotto la media)."],
                    ["Hedge%", "% dei mercati dove il wallet ha comprato su entrambi i lati. Basso = migliore."],
                    ["Late%", "% dei trade piazzati nelle ultime 6 ore prima della chiusura. Basso = migliore."],
                    ["Last Trade", "Data dell'ultimo trade low-prob del wallet."],
                  ].map(([col, desc]) => (
                    <tr key={col} className="border-t border-gray-800/50">
                      <td className="py-2 px-3 text-white font-medium whitespace-nowrap">{col}</td>
                      <td className="py-2 px-3">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 7 */}
          <section id="signals">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">7.</span> Pagina Segnali Live
            </h2>
            <p className="mb-3">
              Mostra i trade BUY recenti a bassa probabilità dei wallet migliori. Sono &quot;segnali copiabili&quot;:
              puoi vedere <strong className="text-white">cosa stanno comprando</strong>, a che prezzo, e se hanno ancora le shares.
            </p>
            <div className="overflow-auto">
              <table className="w-full text-xs border border-gray-800 rounded">
                <thead>
                  <tr className="bg-gray-900/80 text-gray-400">
                    <th className="py-2 px-3 text-left">Colonna</th>
                    <th className="py-2 px-3 text-left">Significato</th>
                  </tr>
                </thead>
                <tbody className="text-gray-400">
                  {[
                    ["Quando", "Quanto tempo fa è stato piazzato il trade (hover per data/ora esatta)."],
                    ["Entry", "Prezzo a cui il wallet ha comprato. Es. 0.0100 = 1% di probabilità implicita."],
                    ["Prezzo att.", "Prezzo corrente del token. Verde (+) se salito, rosso (−) se sceso rispetto all'entry."],
                    ["Size", "Quantità di token comprati (in USDC spesi)."],
                    ["Shares", "Shares nette ancora in mano. Se > 0, la posizione è ancora aperta."],
                    ["Mercato", "Nome del mercato Polymarket con link diretto."],
                  ].map(([col, desc]) => (
                    <tr key={col} className="border-t border-gray-800/50">
                      <td className="py-2 px-3 text-white font-medium whitespace-nowrap">{col}</td>
                      <td className="py-2 px-3">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 8 */}
          <section id="positions">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">8.</span> Pagina Posizioni Aperte
            </h2>
            <p className="mb-3">
              Vista aggregata di tutte le posizioni attualmente aperte (shares &gt; 0) dei wallet migliori.
              A differenza dei segnali che mostrano singoli trade, qui vedi la <strong className="text-white">posizione netta</strong>:
              somma di tutti i BUY meno i SELL su ogni mercato.
            </p>
            <div className="overflow-auto">
              <table className="w-full text-xs border border-gray-800 rounded">
                <thead>
                  <tr className="bg-gray-900/80 text-gray-400">
                    <th className="py-2 px-3 text-left">Colonna</th>
                    <th className="py-2 px-3 text-left">Significato</th>
                  </tr>
                </thead>
                <tbody className="text-gray-400">
                  {[
                    ["Shares", "Quantità netta di token detenuti. Calcolato come Σ BUY − Σ SELL. Se scende a ~0, scompare."],
                    ["Prezzo att.", "Prezzo corrente del token sul CLOB (aggiornato ogni ~10 min)."],
                    ["Idx", "Outcome index (0 = primo outcome, 1 = secondo). Es. 0 = 'Yes', 1 = 'No'."],
                    ["Ultimo trade", "Data dell'ultimo trade del wallet su quel mercato."],
                  ].map(([col, desc]) => (
                    <tr key={col} className="border-t border-gray-800/50">
                      <td className="py-2 px-3 text-white font-medium whitespace-nowrap">{col}</td>
                      <td className="py-2 px-3">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 9 */}
          <section id="wallet">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">9.</span> Dettaglio Wallet
            </h2>
            <p className="mb-3">
              Cliccando su un wallet nella leaderboard, si apre la pagina di dettaglio con:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex gap-2">
                <span className="text-blue-400 flex-shrink-0">→</span>
                <span><strong className="text-white">Profilo</strong> — Follow Score, Alpha-Z, Hedge Rate, Late Rate, data ultimo trade.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 flex-shrink-0">→</span>
                <span><strong className="text-white">Stats per threshold</strong> — Tabella con N, Wins, E[Wins], Variance, Alpha-Z calcolati a 3 soglie diverse (5%, 2%, 1%).</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 flex-shrink-0">→</span>
                <span><strong className="text-white">Upset Wins</strong> — Lista delle vittorie &quot;improbabili&quot;: trade che hanno vinto nonostante fossero a bassissima probabilità, con mercato e prezzo pagato.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 flex-shrink-0">→</span>
                <span><strong className="text-white">Trade recenti</strong> — Ultimi trade BUY low-prob degli ultimi 7 giorni, inclusi mercati non ancora risolti.</span>
              </li>
            </ul>
          </section>

          {/* 10 */}
          <section id="filtri">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">10.</span> Guida ai filtri
            </h2>

            <h3 className="text-white font-semibold mt-4 mb-2">Soglia prezzo (Threshold)</h3>
            <p className="mb-2">
              Definisce quale prezzo massimo considerare come &quot;bassa probabilità&quot;.
              Un token a $0.02 implica che il mercato gli dà il 2% di possibilità.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <div className="text-white font-mono font-semibold mb-1">≤ 0.05 (5%)</div>
                <p className="text-gray-500 text-xs">Più trade analizzati, campione più grande. Include trade &quot;quasi longshot&quot;. Buono per iniziare.</p>
              </div>
              <div className="bg-gray-900/60 rounded p-3 border border-blue-800/50">
                <div className="text-blue-400 font-mono font-semibold mb-1">≤ 0.02 (2%) ★</div>
                <p className="text-gray-500 text-xs">Default consigliato. Trade veramente improbabili. Buon equilibrio tra campione e segnale.</p>
              </div>
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <div className="text-white font-mono font-semibold mb-1">≤ 0.01 (1%)</div>
                <p className="text-gray-500 text-xs">Solo extreme longshot. Meno trade, ma chi vince qui ha un segnale molto forte.</p>
              </div>
            </div>

            <h3 className="text-white font-semibold mt-6 mb-2">Trade minimi (Min N)</h3>
            <p className="mb-2">
              Numero minimo di trade low-prob che un wallet deve avere per apparire nella classifica.
              Più alto = più affidabile ma meno risultati.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <div className="text-white font-mono font-semibold mb-1">N = 1</div>
                <p className="text-gray-500 text-xs">Mostra tutti i wallet con almeno 1 trade. Utile per esplorare, ma dati poco significativi.</p>
              </div>
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <div className="text-white font-mono font-semibold mb-1">N = 10-20</div>
                <p className="text-gray-500 text-xs">Buon compromesso. Il campione inizia a essere statisticamente significativo.</p>
              </div>
              <div className="bg-gray-900/60 rounded p-3 border border-gray-800">
                <div className="text-white font-mono font-semibold mb-1">N = 50+</div>
                <p className="text-gray-500 text-xs">Solo trader molto attivi. Alpha-Z diventa molto affidabile con campioni grandi.</p>
              </div>
            </div>

            <h3 className="text-white font-semibold mt-6 mb-2">Ordina per</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {[
                ["Follow Score", "Punteggio composito. Bilancia performance, volume, qualità e recency. Consigliato."],
                ["Alpha-Z", "Performance pura. Chi vince di più rispetto al caso, indipendentemente dal volume."],
                ["Vittorie", "Numero assoluto di vittorie. Utile per trovare chi vince tanto, anche se con campione piccolo."],
                ["N° trade", "Volume puro. Chi fa più trade low-prob, indipendentemente se vince o perde."],
              ].map(([name, desc]) => (
                <div key={name} className="bg-gray-900/60 rounded p-3 border border-gray-800">
                  <div className="text-white font-semibold text-sm mb-1">{name}</div>
                  <p className="text-gray-500 text-xs">{desc}</p>
                </div>
              ))}
            </div>

            <h3 className="text-white font-semibold mt-6 mb-2">Finestra temporale (Signals)</h3>
            <p className="mb-2 text-gray-400">
              Nella pagina Segnali, controlla quanto indietro cercare i trade recenti.
              <strong className="text-white"> 72 ore</strong> è il default consigliato: abbastanza ampio da catturare
              i segnali, senza mostrare trade troppo vecchi per essere copiati.
            </p>

            <h3 className="text-white font-semibold mt-6 mb-2">Solo Followable</h3>
            <p className="text-gray-400">
              Filtra la classifica mostrando solo wallet che soddisfano tutti i criteri di qualità
              (N≥20, Alpha-Z&gt;0, Hedge≤25%, Late≤60%). Disattivalo per esplorare tutti i wallet analizzati.
            </p>
          </section>

          {/* 11 */}
          <section id="limiti">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">11.</span> Limiti e avvertenze
            </h2>
            <div className="space-y-3">
              <div className="bg-yellow-950/30 border border-yellow-800/50 rounded-lg p-4">
                <h3 className="text-yellow-400 font-semibold text-sm mb-1">Non è un consiglio finanziario</h3>
                <p className="text-gray-400 text-xs">
                  Questa piattaforma è uno strumento di analisi statistica. Le performance passate non garantiscono
                  risultati futuri. Usa queste informazioni come un fattore tra molti nelle tue decisioni.
                </p>
              </div>
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                <h3 className="text-white font-semibold text-sm mb-1">Survivorship bias</h3>
                <p className="text-gray-400 text-xs">
                  Analizziamo solo trade su mercati risolti. Un wallet potrebbe avere molte posizioni aperte
                  in perdita che non vediamo ancora. L&apos;Alpha-Z è retroattivo.
                </p>
              </div>
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                <h3 className="text-white font-semibold text-sm mb-1">Campione limitato</h3>
                <p className="text-gray-400 text-xs">
                  Con pochi mercati risolti, l&apos;Alpha-Z può essere volatile. Un singolo upset win su 5 trade
                  può gonfiare lo z-score. Il campione cresce nel tempo con ogni ciclo di sync.
                </p>
              </div>
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                <h3 className="text-white font-semibold text-sm mb-1">Hedge e wash trading</h3>
                <p className="text-gray-400 text-xs">
                  L&apos;Hedge Rate rileva wallet che coprono le scommesse comprando entrambi i lati. Tuttavia,
                  il wash trading (wallet multipli dallo stesso utente) non è rilevabile.
                </p>
              </div>
            </div>
          </section>

          {/* 12 */}
          <section id="tech">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-blue-400">12.</span> Stack tecnico
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { name: "Next.js 16", desc: "Framework React con API routes e cron jobs" },
                { name: "Neon PostgreSQL", desc: "Database serverless con branching e auto-scaling" },
                { name: "Vercel", desc: "Hosting con edge CDN, caching e cron scheduler" },
                { name: "Polymarket APIs", desc: "Gamma (markets), CLOB (resolutions/prices), Data API (trades)" },
                { name: "TailwindCSS", desc: "Styling utility-first per UI responsive" },
                { name: "TypeScript", desc: "Type safety end-to-end dal DB alla UI" },
              ].map((t) => (
                <div key={t.name} className="bg-gray-900/60 rounded p-3 border border-gray-800">
                  <div className="text-white font-semibold text-sm mb-1">{t.name}</div>
                  <p className="text-gray-500 text-xs">{t.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-gray-500 text-xs">
              Le API pubbliche (leaderboard, signals, positions, wallet) sono cachate sulla CDN Vercel
              (60-120s) per minimizzare le query al database e i costi cloud.
              Il sync cron gira ogni 10 min, il compute ogni 30 min.
            </p>
          </section>

        </div>

        {/* Back to top */}
        <div className="mt-12 pt-6 border-t border-gray-800 text-center">
          <a href="#" className="text-blue-400 hover:underline text-sm">↑ Torna all&apos;inizio</a>
        </div>
      </main>
    </div>
  );
}

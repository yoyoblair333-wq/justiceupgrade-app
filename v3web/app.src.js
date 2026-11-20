import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT = window.JU_CONTRACT;
const EXPLORER = "https://explorer-studio.genlayer.com";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
const client = createClient({ chain: studionet });
const toObj = (v) => v instanceof Map ? Object.fromEntries([...v].map(([k, x]) => [k, toObj(x)])) : Array.isArray(v) ? v.map(toObj) : typeof v === "bigint" ? v.toString() : v;
const read = async (fn, args = []) => toObj(await client.readContract({ address: CONTRACT, functionName: fn, args }));

function evList(items) {
  if (!items || !items.length) return `<p class="muted">No exhibits.</p>`;
  return items.map((e) => `<div class="ex"><b>${esc(e.label)}</b> <span class="k">${esc(e.kind)}</span>
    ${e.kind === "url" ? `<div><a href="${esc(e.content)}" target="_blank" rel="noopener">${esc(e.content.split("/").slice(-1)[0])}</a></div>` : `<div>${esc(e.content)}</div>`}
    ${e.fetched_excerpt ? `<div class="fetched"><span>Fetched live by the contract</span>${esc(e.fetched_excerpt)}</div>` : ""}
    <div class="sha">sha256 ${esc((e.sha256 || "").slice(0, 16))}…</div></div>`).join("");
}
function badge(s) { return `<span class="badge ${esc(s)}">${esc(s)}</span>`; }

async function show(id) {
  $("#case").innerHTML = `<p class="muted">Loading ${esc(id)} from studionet…</p>`;
  try {
    const a = await read("get_agreement", [id]);
    const filerIsA = (a.filed_by || "").toLowerCase() === (a.party_a || "").toLowerCase();
    const filerRole = filerIsA ? "Party A" : "Party B", respRole = filerIsA ? "Party B" : "Party A";
    const offer = a.settlement_offer;
    $("#case").innerHTML = `
      <div class="head"><h2>${esc(a.id)}</h2>${badge(a.status)}${a.default_proceeding ? badge("default proceeding") : ""}</div>
      <p class="terms">“${esc(a.terms)}”</p>
      <div class="sides">
        <section><h3>Dispute · ${filerRole} <small>${short(a.filed_by)}</small></h3><p>${esc(a.dispute) || '<span class="muted">No dispute filed.</span>'}</p>${evList(a.evidence)}</section>
        <section><h3>Answer · ${respRole} <small>${short(a.respondent)}</small></h3>${a.answer ? `<p>${esc(a.answer)}</p>${evList(a.answer_evidence)}` : `<p class="muted">${a.default_proceeding ? "No answer within the response window. The panel was told silence is not an admission." : "No answer yet."}</p>`}</section>
      </div>
      <div class="verdict">
        ${a.ruling ? `<div class="r"><span>Outcome</span><b>${esc(a.ruling)}</b>${a.status === "settled" ? " <em>by settlement</em>" : ` <em>tier ${a.tier} · panel of ${a.arbiters} · votes ${esc((a.votes || []).join(", "))}</em>`}</div>` : `<div class="muted">No ruling yet.</div>`}
        ${a.reasoning && a.status !== "settled" ? `<p><b>Reasoning.</b> ${esc(a.reasoning)}</p>` : ""}
        ${a.resolution ? `<p><b>Remedy.</b> ${esc(a.resolution)}</p>` : ""}
        ${offer && (a.status === "disputed" || a.status === "ruled") ? `<p class="offer"><b>Open settlement offer</b> from ${short(offer.by)}: ${esc(offer.outcome)}: “${esc(offer.terms)}”</p>` : ""}
      </div>
      <h3>Timeline</h3><ol class="tl">${(a.history || []).map((h) => `<li>${h.settled ? "Settled" : "Tier " + h.tier + " ruling"}: <b>${esc(h.ruling)}</b> <span class="muted">${esc(h.at)}</span></li>`).join("") || "<li class='muted'>No rulings yet.</li>"}</ol>`;
  } catch (e) {
    $("#case").innerHTML = `<p class="muted">No case "${esc(id)}" on this contract yet.</p>`;
  }
}
async function ledger() {
  try {
    const [p, st, cfg] = await Promise.all([read("get_precedents", [10]), read("precedent_stats"), read("get_config")]);
    $("#stats").innerHTML = `<div><span>Precedents</span><b>${st.total}</b></div><div><span>Settled</span><b>${st.settled}</b></div><div><span>Response window</span><b>${cfg.response_window_seconds}s</b></div><div><span>Schema</span><b>${esc(cfg.schema)}</b></div>`;
    $("#ledger").innerHTML = p.map((x) => `<li>${badge(x.ruling)} ${x.settled ? badge("settled") : ""} ${esc(x.principle)} <span class="muted">${esc(x.at)}</span></li>`).join("") || "<li class='muted'>No precedents yet.</li>";
    $("#status").textContent = "live · " + new Date().toLocaleTimeString(); $("#status").className = "ok";
  } catch (e) { $("#status").textContent = "studionet unreachable"; $("#status").className = "bad"; }
}
$("#addr").innerHTML = `<a href="${EXPLORER}/address/${CONTRACT}" target="_blank" rel="noopener">${CONTRACT}</a>`;
document.querySelectorAll("[data-case]").forEach((b) => b.addEventListener("click", () => show(b.dataset.case)));
$("#go").addEventListener("click", () => show($("#cid").value.trim()));
show(new URLSearchParams(location.search).get("case") || "ship-1");
ledger(); setInterval(ledger, 30000);

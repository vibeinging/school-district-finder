/* 朝阳小学指南 · 前端逻辑（纯静态，无依赖）
 * 数据由 data.js 注入 window.APP_DATA：
 *   communities: [{n,p,i,s,a,d,m}]  schools:[{n,c,ac}]  by_school:{name:{c:[],a:[]}}
 */
(function () {
  "use strict";

  var D = window.APP_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var MQ_DESKTOP = window.matchMedia("(min-width: 1024px)");

  /* ---------- 工具 ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function debounce(fn, ms) {
    var t = 0;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }
  function sameArray(x, y) {
    // 顺序无关的集合比较：派位池与单校"同集合不同序"也视为一致
    if (!x || !y || x.length !== y.length) return false;
    var seen = {};
    for (var i = 0; i < x.length; i++) seen[x[i]] = (seen[x[i]] || 0) + 1;
    for (var j = 0; j < y.length; j++) {
      if (!seen[y[j]]) return false;
      seen[y[j]] -= 1;
    }
    return true;
  }

  /* ---------- 搜索历史 ---------- */

  var RECENT_KEY = "cyxx-recent";
  var pendingQuery = ""; // 当前搜索词，点击结果时收入历史
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; }
  }
  function pushRecent(name) {
    var list = getRecent().filter(function (x) { return x !== name; });
    list.unshift(name);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10))); } catch (e) { /* 忽略 */ }
  }
  function renderRecent() {
    var list = getRecent();
    $("recent-box").hidden = list.length === 0;
    $("recent-list").innerHTML = list.map(function (n) {
      return '<button class="chip" data-name="' + esc(n) + '">' + esc(n) + "</button>";
    }).join("");
  }

  /* ---------- 小区搜索 ---------- */

  function searchCommunities(qRaw) {
    var q = qRaw.trim().toLowerCase();
    if (!q) return [];
    var starts = [], contains = [];
    for (var i = 0; i < D.communities.length; i++) {
      var c = D.communities[i];
      var n = c.n, p = c.p, ini = c.i;
      if (n.indexOf(q) === 0 || p.indexOf(q) === 0 || ini.indexOf(q) === 0) {
        starts.push(i);
      } else if (n.indexOf(q) !== -1 || p.indexOf(q) !== -1 || ini.indexOf(q) !== -1) {
        contains.push(i);
      }
      if (starts.length >= 40) break;
    }
    return starts.concat(contains).slice(0, 40);
  }

  function renderCommunityResults(qRaw) {
    var box = $("community-results");
    var def = $("home-default");
    var q = qRaw.trim();
    if (!q) { box.innerHTML = ""; def.hidden = false; renderRecent(); return; }
    def.hidden = true;
    $("recent-box").hidden = true;
    var idxs = searchCommunities(q);
    pendingQuery = q;
    if (!idxs.length) {
      box.innerHTML = '<li><div class="empty">没有匹配的小区。<br>试试更短的关键词（如「望京」「大屯」），或核对小区全称。</div></li>';
      return;
    }
    box.innerHTML = idxs.map(function (i) {
      var c = D.communities[i];
      var cnt = c.s.length;
      return '<li><button class="row-btn" data-idx="' + i + '">' +
        '<span class="row-main"><span class="name">' + esc(c.n) + "</span>" +
        (c.s.length ? '<span class="row-sub">' + esc(c.s.join(" · ")) + "</span>" : "") +
        "</span>" +
        '<span class="badge">' + (cnt > 1 ? cnt + " 所学校" : cnt === 1 ? "单校" : "见详情") + "</span>" +
        '<span class="chev">›</span>' +
        "</button></li>";
    }).join("");
  }

  /* ---------- 小区详情 ---------- */

  function schoolChip(name) {
    return '<button class="school-chip" data-school="' + esc(name) + '">' + esc(name) + "</button>";
  }

  function renderCommunityDetail(idx) {
    var c = D.communities[idx];
    if (!c) { location.hash = "#/home"; return; }
    var html = [
      '<div class="detail">',
      '<div class="back-row"><button class="back-btn" data-back="home">‹ 返回搜索</button></div>',
      '<h2>' + esc(c.n) + "</h2>",
      c.d ? '<div class="tag-row"><span class="tag">该小区派位统筹入学</span></div>' : "",

      '<div class="section sec-a"><div class="section-title"><span class="idx"><i>①</i></span>对应学校 · <b>2017-06-30 前取得房产证</b>（单校划片）</div>',
      '<div class="school-chips">' + (c.s.length
        ? c.s.map(schoolChip).join("")
        : '<span class="school-chip plain">官方查询无单校对应</span>') + "</div></div>",

      '<div class="section sec-b"><div class="section-title"><span class="idx"><i>②</i></span>多校派位范围 · <b>2017-06-30 后取得房产证</b></div>',
      '<div class="school-chips">' +
        (!c.a.length
          ? '<span class="school-chip plain">官方未提供派位范围</span>'
          : sameArray(c.a, c.s)
            ? '<span class="school-chip plain">与单校划片一致</span>'
            : c.a.map(schoolChip).join("")) +
      "</div></div>",

      '<p class="note">依据就近入学原则，实际入学以当年教委规定与学校招生公告为准；' +
      "一个地址小学六年内原则上只提供一个学位（多孩除外）。</p>",
      "</div>"
    ].join("");
    var host = document.createElement("div");
    host.className = "detail-host";
    host.innerHTML = html;
    var old = document.querySelector(".detail-host");
    if (old) old.remove();
    $("view-home").appendChild(host);
    $("view-home").classList.add("has-detail");

    if (MQ_DESKTOP.matches) {
      // 桌面双栏：列表保留，仅高亮选中行，不动输入框与滚动
      var rows = document.querySelectorAll("#community-results .row-btn");
      for (var r = 0; r < rows.length; r++) {
        rows[r].classList.toggle("selected", rows[r].dataset.idx === String(idx));
      }
    } else {
      $("community-results").innerHTML = "";
      $("home-default").hidden = true;
      $("recent-box").hidden = true;
      $("q-community").value = c.n;
      window.scrollTo(0, 0);
    }
  }

  /* ---------- 学校列表 / 详情 ---------- */

  var schoolChunk = 50;
  function renderSchoolList(qRaw) {
    var q = qRaw.trim().toLowerCase();
    var list = D.schools.filter(function (s) {
      if (!q) return true;
      return s.n.toLowerCase().indexOf(q) !== -1 ||
             s.p.indexOf(q) !== -1 || s.i.indexOf(q) !== -1;
    });
    var box = $("school-results");
    if (!list.length) {
      box.innerHTML = '<li><div class="empty">没有匹配的学校</div></li>';
      return;
    }
    box.innerHTML = list.slice(0, 60).map(function (s) {
      return '<li><button class="row-btn" data-school="' + esc(s.n) + '">' +
        '<span class="name">' + esc(s.n) + "</span>" +
        (s.c ? '<span class="badge">' + s.c + " 个小区</span>" : "") +
        (s.ac ? '<span class="badge mut">派位' + s.ac + "</span>" : "") +
        '<span class="chev">›</span>' +
        "</button></li>";
    }).join("");
  }

  function communityMini(idx) {
    var c = D.communities[idx];
    return '<button class="community-mini" data-idx="' + idx + '"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:inherit;">' + esc(c.n) + '</span><span class="chev">›</span></button>';
  }

  function renderSchoolDetail(name) {
    var info = D.by_school[name];
    if (!info) { location.hash = "#/school"; return; }
    var cList = info.c || [], aList = info.a || [];
    var html = [
      '<div class="detail">',
      '<div class="back-row"><button class="back-btn" data-back="school">‹ 返回学校列表</button></div>',
      '<h2>' + esc(name) + "</h2>",

      '<div class="section sec-a"><div class="section-title"><span class="idx"><i>①</i></span>对口小区 · <b>2017-06-30 前购房</b>（单校划片）· 共 ' + cList.length + " 个</div>",
      '<div data-role="c-list"></div></div>',

      aList.length
        ? '<div class="section sec-b"><div class="section-title"><span class="idx"><i>②</i></span>派位范围包含 · <b>2017-06-30 后购房</b> · 共 ' + aList.length + " 个</div><div data-role=\"a-list\"></div></div>"
        : "",
      "</div>"
    ].join("");

    var old = document.querySelector(".detail-host");
    if (old) old.remove();
    var host = document.createElement("div");
    host.className = "detail-host";
    host.innerHTML = html;
    $("view-school").appendChild(host);
    $("view-school").classList.add("has-detail");

    if (MQ_DESKTOP.matches) {
      var rows = document.querySelectorAll("#school-results .row-btn");
      for (var r = 0; r < rows.length; r++) {
        rows[r].classList.toggle("selected", rows[r].dataset.school === name);
      }
    } else {
      $("q-school").value = name;
      $("school-results").innerHTML = "";
      window.scrollTo(0, 0);
    }

    function fillChunk(role, arr) {
      var el = host.querySelector('[data-role="' + role + '"]');
      var shown = el ? Number(el.dataset.shown || 0) : 0;
      if (!el) return;
      el.innerHTML = arr.slice(0, shown + schoolChunk).map(communityMini).join("") +
        (shown + schoolChunk < arr.length
          ? '<button class="more-btn" data-more="' + role + '">加载更多（剩余 ' + (arr.length - shown - schoolChunk) + "）</button>"
          : "");
      el.dataset.shown = shown + schoolChunk;
    }
    fillChunk("c-list", cList);
    fillChunk("a-list", aList);
    host.__fill = fillChunk; host.__c = cList; host.__a = aList;
  }

  /* ---------- 路由与 Tab ---------- */

  function showTab(tab) {
    ["home", "school", "policy"].forEach(function (t) {
      $("view-" + t).hidden = t !== tab;
    });
    document.querySelectorAll(".tab, .tnav").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    if (!MQ_DESKTOP.matches) {
      var input = tab === "home" ? $("q-community") : tab === "school" ? $("q-school") : null;
      if (input && !input.value) input.focus();
    }
  }

  function clearDetails() {
    document.querySelectorAll(".detail-host").forEach(function (el) { el.remove(); });
    $("view-home").classList.remove("has-detail");
    $("view-school").classList.remove("has-detail");
  }

  function route() {
    var h = location.hash || "#/home";
    var parts = h.slice(2).split("/");
    clearDetails();
    if (parts[0] === "c" && /^\d+$/.test(parts[1] || "")) {
      var idx = Number(parts[1]);
      if (idx >= 0 && idx < D.communities.length) {
        showTab("home");
        renderCommunityDetail(idx);
        pushRecent(D.communities[idx].n);
      } else {
        location.hash = "#/home"; // 越界索引（手改 URL）安全回首页
      }
    } else if (parts[0] === "s" && parts[1]) {
      showTab("school");
      renderSchoolDetail(decodeURIComponent(parts[1]));
    } else if (parts[0] === "school") {
      showTab("school");
      renderSchoolList($("q-school").value);
    } else if (parts[0] === "policy") {
      showTab("policy");
    } else {
      showTab("home");
      renderCommunityResults($("q-community").value);
    }
  }

  /* ---------- 事件 ---------- */

  $("q-community").addEventListener("input", debounce(function (e) {
    if (document.querySelector(".detail-host")) { clearDetails(); location.hash = "#/home"; }
    renderCommunityResults(e.target.value);
  }, 120));

  // 聚焦空输入框时展示搜索历史
  $("q-community").addEventListener("focus", function (e) {
    if (!e.target.value.trim()) renderCommunityResults("");
  });

  $("q-school").addEventListener("input", debounce(function (e) {
    if (document.querySelector(".detail-host")) { clearDetails(); location.hash = "#/school"; }
    renderSchoolList(e.target.value);
  }, 120));

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, a");
    if (!t) return;

    if (t.dataset.tab) { location.hash = "#/" + t.dataset.tab; return; }

    if (t.dataset.idx !== undefined && t.dataset.idx !== "") {
      var ci = Number(t.dataset.idx);
      // 点击搜索结果：把本次搜索词收入历史（与小区名都保留，便于复现）
      if (pendingQuery && pendingQuery !== D.communities[ci].n) pushRecent(pendingQuery);
      location.hash = "#/c/" + ci; return;
    }
    if (t.dataset.school) {
      location.hash = "#/s/" + encodeURIComponent(t.dataset.school); return;
    }
    if (t.dataset.back) {
      history.length > 1 ? history.back() : (location.hash = "#/" + t.dataset.back);
      return;
    }
    if (t.dataset.more) {
      var host = document.querySelector(".detail-host");
      if (host && host.__fill) {
        host.__fill(t.dataset.more, t.dataset.more === "c-list" ? host.__c : host.__a);
      }
      return;
    }
    if (t.dataset.name) { // 最近查询 chip
      $("q-community").value = t.dataset.name;
      renderCommunityResults(t.dataset.name);
      return;
    }
    if (t.id === "recent-clear") {
      try { localStorage.removeItem(RECENT_KEY); } catch (err) { /* 忽略 */ }
      renderRecent();
    }
  });

  window.addEventListener("hashchange", route);

  /* ---------- 初始化 ---------- */

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function countUp(el, target) {
    if (!el) return;
    if (REDUCED) { el.textContent = target.toLocaleString(); return; }
    var t0 = performance.now(), dur = 850;
    // 用 setTimeout 而非 rAF：rAF 在无渲染帧的环境（如部分 webview/后台页）会冻结
    (function tick() {
      var p = Math.min((performance.now() - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) setTimeout(tick, 16);
    })();
  }

  countUp($("stat-count"), D.meta.count);
  $("stat-schools").textContent = D.meta.school_count;
  $("school-total").textContent = D.meta.school_count;
  $("year-pill").textContent = D.meta.year + " 年数据";
  $("stat-year").textContent = D.meta.year;
  $("meta-sub").textContent = "你住的地方，能上哪个小学 · " + D.meta.district + " · " + D.meta.year + " 年数据";
  $("policy-meta").textContent =
    "数据来源：" + D.meta.source + "｜导出于 " + D.meta.built_at.slice(0, 10) +
    "｜覆盖 " + D.meta.count.toLocaleString() + " 个住宅小区 / " + D.meta.school_count + " 所小学";
  renderRecent();
  route();
})();

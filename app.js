// 인천공항고등학교 2022 개정 교육과정 선택과목 시뮬레이터 & 플래너 스크립트
document.addEventListener("DOMContentLoaded", () => {
  const MAX_PER_SEMESTER = 5;

  // 상태 관리
  const state = {
    selectedSubjects: JSON.parse(localStorage.getItem("incheonAirportPlan") || "[]"),
    activeTab: "tab-major-finder",
    currentMajor: null,
    catalogFilterSem: "all",
    catalogFilterGroup: "all",
    catalogSearchQuery: "",
    modalSubjectId: null
  };

  // DOM 요소 캐싱
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const cartCountBadge = document.getElementById("cartCountBadge");
  const toastContainer = document.getElementById("toastContainer");

  // 시뮬레이터 DOM
  const categorySelect = document.getElementById("categorySelect");
  const majorSelect = document.getElementById("majorSelect");
  const majorSearchInput = document.getElementById("majorSearchInput");
  const majorRecommendationResult = document.getElementById("majorRecommendationResult");

  // 카탈로그 DOM
  const subjectGrid = document.getElementById("subjectGrid");
  const semesterPills = document.querySelectorAll("#semesterFilter .pill");
  const groupPills = document.querySelectorAll("#groupFilter .pill");
  const subjectSearchInput = document.getElementById("subjectSearchInput");

  // 플래너 DOM
  const sem1SelectedList = document.getElementById("sem1SelectedList");
  const sem2SelectedList = document.getElementById("sem2SelectedList");
  const sem1Count = document.getElementById("sem1Count");
  const sem2Count = document.getElementById("sem2Count");
  const sem1StatusBadge = document.getElementById("sem1StatusBadge");
  const sem2StatusBadge = document.getElementById("sem2StatusBadge");
  const sem1ProgressBar = document.getElementById("sem1ProgressBar");
  const sem2ProgressBar = document.getElementById("sem2ProgressBar");
  const plannerTargetMajor = document.getElementById("plannerTargetMajor");
  const plannerQuickApplyWrap = document.getElementById("plannerQuickApplyWrap");
  const applySem1RecBtn = document.getElementById("applySem1RecBtn");
  const applySem2RecBtn = document.getElementById("applySem2RecBtn");
  const plannerDiagnosisResult = document.getElementById("plannerDiagnosisResult");
  const plannerGroupBalance = document.getElementById("plannerGroupBalance");
  const printPlanBtn = document.getElementById("printPlanBtn");
  const clearPlanBtn = document.getElementById("clearPlanBtn");

  // 요약 테이블
  const summaryTableBody = document.getElementById("summaryTableBody");

  // 모달 DOM
  const subjectModal = document.getElementById("subjectModal");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalCloseActionBtn = document.getElementById("modalCloseActionBtn");
  const modalAddPlannerBtn = document.getElementById("modalAddPlannerBtn");

  // ----------------------------------------------------
  // 0. 토스트 알림 함수
  // ----------------------------------------------------
  function showToast(message, type = "info") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    let icon = "ℹ️";
    if (type === "warning") icon = "⚠️";
    if (type === "success") icon = "✅";

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
  }

  // ----------------------------------------------------
  // 1. 탭 네비게이션
  // ----------------------------------------------------
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });

  function switchTab(tabId) {
    state.activeTab = tabId;
    tabButtons.forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === tabId));
    tabPanels.forEach(p => p.classList.toggle("active", p.id === tabId));
    window.scrollTo({ top: 350, behavior: "smooth" });
  }

  // ----------------------------------------------------
  // 2. 초기 데이터 셋업 (시뮬레이터 & 셀렉트)
  // ----------------------------------------------------
  function initSimulator() {
    categorySelect.innerHTML = "";
    MAJOR_CATEGORIES.forEach((cat, index) => {
      const opt = document.createElement("option");
      opt.value = index;
      opt.textContent = cat.category;
      categorySelect.appendChild(opt);
    });

    updateMajorOptions();

    categorySelect.addEventListener("change", () => {
      updateMajorOptions();
      renderMajorRecommendation();
    });

    majorSelect.addEventListener("change", () => {
      renderMajorRecommendation();
    });

    majorSearchInput.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        updateMajorOptions();
        renderMajorRecommendation();
        return;
      }

      majorSelect.innerHTML = "";
      let firstFound = null;
      MAJOR_CATEGORIES.forEach((cat, catIdx) => {
        cat.majors.forEach((m, mIdx) => {
          if (m.name.toLowerCase().includes(q) || cat.category.toLowerCase().includes(q)) {
            const opt = document.createElement("option");
            opt.value = `${catIdx}-${mIdx}`;
            opt.textContent = `[${cat.category.split(' ')[0]}] ${m.name}`;
            majorSelect.appendChild(opt);
            if (!firstFound) firstFound = `${catIdx}-${mIdx}`;
          }
        });
      });

      if (firstFound) {
        majorSelect.value = firstFound;
        renderMajorRecommendation();
      } else {
        majorRecommendationResult.innerHTML = `
          <div class="major-overview-card" style="text-align:center; padding: 40px; color: #94a3b8;">
            <h4>🔍 '${q}'에 대한 검색 결과가 없습니다.</h4>
            <p>상단 계열 선택 드롭다운에서 직접 선택해 보세요.</p>
          </div>
        `;
      }
    });

    renderMajorRecommendation();
  }

  function updateMajorOptions() {
    const catIndex = parseInt(categorySelect.value, 10) || 0;
    const cat = MAJOR_CATEGORIES[catIndex];
    majorSelect.innerHTML = "";
    if (!cat) return;

    cat.majors.forEach((m, mIndex) => {
      const opt = document.createElement("option");
      opt.value = `${catIndex}-${mIndex}`;
      opt.textContent = m.name;
      majorSelect.appendChild(opt);
    });

    populatePlannerMajorOptions();
  }

  function populatePlannerMajorOptions() {
    plannerTargetMajor.innerHTML = '<option value="">-- 목표 학과를 선택하세요 --</option>';
    MAJOR_CATEGORIES.forEach((cat, catIdx) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = cat.category;
      cat.majors.forEach((m, mIdx) => {
        const opt = document.createElement("option");
        opt.value = `${catIdx}-${mIdx}`;
        opt.textContent = m.name;
        optgroup.appendChild(opt);
      });
      plannerTargetMajor.appendChild(optgroup);
    });

    plannerTargetMajor.addEventListener("change", () => {
      renderPlannerDiagnosis();
    });
  }

  // ----------------------------------------------------
  // 3. 학과별 권장과목 시뮬레이션 결과 렌더링
  // ----------------------------------------------------
  function renderMajorRecommendation() {
    const val = majorSelect.value;
    if (!val) return;

    const [catIdx, mIdx] = val.split("-").map(Number);
    const cat = MAJOR_CATEGORIES[catIdx];
    if (!cat) return;
    const major = cat.majors[mIdx];
    if (!major) return;

    state.currentMajor = major;

    // 인천공항고 개설과목 객체 매핑
    const sem1RecSubjects = SUBJECTS_DATA.filter(s => s.semester === 1 && major.incheonAirportMatching.sem1.includes(s.name));
    const sem2RecSubjects = SUBJECTS_DATA.filter(s => s.semester === 2 && major.incheonAirportMatching.sem2.includes(s.name));

    majorRecommendationResult.innerHTML = `
      <div class="major-overview-card">
        <div class="major-title-wrap">
          <div>
            <span class="category-tag">${cat.category}</span>
            <h3 style="margin-top: 6px;">${major.name}</h3>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="applyFullPackToPlanner('${catIdx}-${mIdx}')">
              ⚡ 추천 10과목(1학기 5개 + 2학기 5개) 일괄 담기
            </button>
            <button class="btn btn-outline" onclick="selectThisMajorInPlanner('${catIdx}-${mIdx}')">
              🎯 목표 학과로 설정
            </button>
          </div>
        </div>

        <div class="univ-reqs-box">
          <div class="req-col core">
            <h5>🔥 2028 대입 주요 대학 [핵심 권장과목]</h5>
            <div class="subject-pills">
              ${major.univReqs.core.map(c => `<span class="sub-pill core">${c}</span>`).join("")}
            </div>
          </div>
          <div class="req-col rec">
            <h5>✨ 주요 대학 [권장과목]</h5>
            <div class="subject-pills">
              ${major.univReqs.recommended.map(r => `<span class="sub-pill rec">${r}</span>`).join("")}
            </div>
          </div>
        </div>
        <div class="univ-note">📌 <strong>대학 평가 기준 안내:</strong> ${major.univReqs.note}</div>
        
        <div class="school-strategy-box">
          <strong>✈️ 인천공항고 맞춤 이수 로드맵:</strong> ${major.incheonAirportMatching.strategy}
        </div>
      </div>

      <div class="airport-matched-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <h4>🏫 인천공항고 개설과목 중 [${major.name}] 전공 맞춤 추천 (학기당 5과목 패키지)</h4>
        </div>
        
        <div class="matched-semesters-grid">
          <!-- 1학기 추천 (5과목) -->
          <div class="semester-col-box">
            <div class="col-header sem1">
              <span>🌸 1학기 추천 5과목</span>
              <button class="btn btn-sm btn-outline" onclick="applySingleSemPack('${catIdx}-${mIdx}', 1)">
                ＋ 1학기 5과목 한번에 담기
              </button>
            </div>
            <div class="matched-cards-list">
              ${sem1RecSubjects.map(sub => renderSubjectCardHTML(sub, true)).join("")}
            </div>
          </div>

          <!-- 2학기 추천 (5과목) -->
          <div class="semester-col-box">
            <div class="col-header sem2">
              <span>🍁 2학기 추천 5과목</span>
              <button class="btn btn-sm btn-outline" onclick="applySingleSemPack('${catIdx}-${mIdx}', 2)">
                ＋ 2학기 5과목 한번에 담기
              </button>
            </div>
            <div class="matched-cards-list">
              ${sem2RecSubjects.map(sub => renderSubjectCardHTML(sub, true)).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 목표 학과 추천 5과목 단일 학기 일괄 담기
  window.applySingleSemPack = function(val, semester) {
    const [catIdx, mIdx] = val.split("-").map(Number);
    const major = MAJOR_CATEGORIES[catIdx].majors[mIdx];
    if (!major) return;

    const targetList = semester === 1 ? major.incheonAirportMatching.sem1 : major.incheonAirportMatching.sem2;
    
    // 해당 학기 기존 과목 제거
    state.selectedSubjects = state.selectedSubjects.filter(s => s.semester !== semester);

    // 해당 학기 추천 5과목 추가
    let addedCount = 0;
    targetList.slice(0, MAX_PER_SEMESTER).forEach(name => {
      const sub = SUBJECTS_DATA.find(s => s.semester === semester && s.name === name);
      if (sub) {
        state.selectedSubjects.push({
          id: sub.id,
          semester: sub.semester,
          name: sub.name,
          group: sub.group,
          credits: sub.credits
        });
        addedCount++;
      }
    });

    savePlannerState();
    showToast(`✅ [${semester}학기] ${major.name} 추천 ${addedCount}개 과목이 담겼습니다. (5/5 완료)`, "success");
    renderPlanner();
    renderCatalog();
    renderMajorRecommendation();
  };

  // 목표 학과 추천 10과목(1학기 5개 + 2학기 5개) 전체 일괄 담기
  window.applyFullPackToPlanner = function(val) {
    const [catIdx, mIdx] = val.split("-").map(Number);
    const major = MAJOR_CATEGORIES[catIdx].majors[mIdx];
    if (!major) return;

    state.selectedSubjects = [];

    // 1학기 5개
    major.incheonAirportMatching.sem1.slice(0, MAX_PER_SEMESTER).forEach(name => {
      const sub = SUBJECTS_DATA.find(s => s.semester === 1 && s.name === name);
      if (sub) {
        state.selectedSubjects.push({
          id: sub.id,
          semester: 1,
          name: sub.name,
          group: sub.group,
          credits: sub.credits
        });
      }
    });

    // 2학기 5개
    major.incheonAirportMatching.sem2.slice(0, MAX_PER_SEMESTER).forEach(name => {
      const sub = SUBJECTS_DATA.find(s => s.semester === 2 && s.name === name);
      if (sub) {
        state.selectedSubjects.push({
          id: sub.id,
          semester: 2,
          name: sub.name,
          group: sub.group,
          credits: sub.credits
        });
      }
    });

    savePlannerState();
    plannerTargetMajor.value = val;
    showToast(`🎉 [${major.name}] 맞춤 10과목(1학기 5개 + 2학기 5개)이 완성되었습니다!`, "success");
    switchTab("tab-planner");
    renderPlanner();
  };

  window.selectThisMajorInPlanner = function(val) {
    plannerTargetMajor.value = val;
    switchTab("tab-planner");
    renderPlannerDiagnosis();
  };

  // ----------------------------------------------------
  // 4. 과목 카드 HTML 렌더러
  // ----------------------------------------------------
  function renderSubjectCardHTML(sub, isMini = false) {
    const isAdded = state.selectedSubjects.some(item => item.id === sub.id);
    const isGradeFree = sub.name === "금융과 경제생활";

    return `
      <div class="subject-item-card" data-id="${sub.id}">
        <div class="card-top">
          <h4>${sub.name}</h4>
          <div class="card-badges">
            <span class="badge-tag ${sub.semester === 1 ? 'sem1' : 'sem2'}">${sub.semester}학기</span>
            <span class="badge-tag group">${sub.group}</span>
            <span class="badge-tag">${sub.type}</span>
            ${isGradeFree ? `<span class="badge-tag grade-free">등급 미산출(P/A~E)</span>` : ''}
          </div>
        </div>
        <p class="card-summary">${sub.summary}</p>
        <div class="card-careers">
          ${sub.careers.slice(0, 3).map(c => `<span class="career-pill">💼 ${c}</span>`).join("")}
        </div>
        <div class="card-footer-actions">
          <button class="btn-detail" onclick="openSubjectModal('${sub.id}')">상세 소개 🔍</button>
          <button class="btn-add ${isAdded ? 'added' : ''}" onclick="togglePlannerSubject('${sub.id}')">
            ${isAdded ? '담김 ✓' : '수강 담기 ＋'}
          </button>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // 5. 카탈로그(도감) 렌더링 & 필터링
  // ----------------------------------------------------
  function renderCatalog() {
    const sem = state.catalogFilterSem;
    const group = state.catalogFilterGroup;
    const query = state.catalogSearchQuery.toLowerCase();

    const filtered = SUBJECTS_DATA.filter(sub => {
      const matchSem = sem === "all" || sub.semester === parseInt(sem, 10);
      const matchGroup = group === "all" || sub.group === group;
      const matchQuery = !query || 
        sub.name.toLowerCase().includes(query) ||
        sub.summary.toLowerCase().includes(query) ||
        sub.careers.some(c => c.toLowerCase().includes(query)) ||
        sub.majors.some(m => m.toLowerCase().includes(query)) ||
        sub.tags.some(t => t.toLowerCase().includes(query));
      return matchSem && matchGroup && matchQuery;
    });

    if (filtered.length === 0) {
      subjectGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #94a3b8; background: white; border-radius: 12px;">
          <h4>🔍 일치하는 선택과목이 없습니다.</h4>
          <p>필터 조건을 초기화하거나 다른 검색어를 입력해 보세요.</p>
        </div>
      `;
      return;
    }

    subjectGrid.innerHTML = filtered.map(sub => renderSubjectCardHTML(sub, false)).join("");
  }

  semesterPills.forEach(pill => {
    pill.addEventListener("click", () => {
      semesterPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.catalogFilterSem = pill.getAttribute("data-sem");
      renderCatalog();
    });
  });

  groupPills.forEach(pill => {
    pill.addEventListener("click", () => {
      groupPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.catalogFilterGroup = pill.getAttribute("data-group");
      renderCatalog();
    });
  });

  subjectSearchInput.addEventListener("input", (e) => {
    state.catalogSearchQuery = e.target.value.trim();
    renderCatalog();
  });

  // ----------------------------------------------------
  // 6. 모달 팝업 제어
  // ----------------------------------------------------
  window.openSubjectModal = function(id) {
    const sub = SUBJECTS_DATA.find(s => s.id === id);
    if (!sub) return;

    state.modalSubjectId = id;
    const isAdded = state.selectedSubjects.some(item => item.id === sub.id);

    document.getElementById("modalSemBadge").textContent = `${sub.semester}학기`;
    document.getElementById("modalGroupBadge").textContent = sub.group;
    document.getElementById("modalTypeBadge").textContent = sub.type;
    document.getElementById("modalSubjectName").textContent = sub.name;
    document.getElementById("modalGradeType").innerHTML = `<strong>성적 산출 방식:</strong> ${sub.gradeType} <br><span style="color:#64748b; font-size:12px;">${sub.evaluationNote}</span>`;
    
    document.getElementById("modalSummary").textContent = sub.summary;
    document.getElementById("modalRecommendedFor").textContent = sub.recommendedFor;

    const majorsWrap = document.getElementById("modalMajors");
    majorsWrap.innerHTML = sub.majors.map(m => `<span class="tag-badge">🎓 ${m}</span>`).join("");

    const careersWrap = document.getElementById("modalCareers");
    careersWrap.innerHTML = sub.careers.map(c => `<span class="tag-badge">💼 ${c}</span>`).join("");

    const topicsList = document.getElementById("modalTopicsList");
    topicsList.innerHTML = sub.keyTopics.map(t => `<li>${t}</li>`).join("");

    document.getElementById("modalConcept").textContent = sub.deepConcepts;

    modalAddPlannerBtn.disabled = false;
    modalAddPlannerBtn.textContent = isAdded ? "✓ 내 수강계획에서 빼기" : "➕ 내 수강계획에 담기 (최대 5개)";
    modalAddPlannerBtn.className = isAdded ? "btn btn-outline" : "btn btn-primary";

    subjectModal.classList.add("show");
  };

  function closeModal() {
    subjectModal.classList.remove("show");
  }

  modalCloseBtn.addEventListener("click", closeModal);
  modalCloseActionBtn.addEventListener("click", closeModal);
  subjectModal.addEventListener("click", (e) => {
    if (e.target === subjectModal) closeModal();
  });

  modalAddPlannerBtn.addEventListener("click", () => {
    if (state.modalSubjectId) {
      togglePlannerSubject(state.modalSubjectId);
      openSubjectModal(state.modalSubjectId);
    }
  });

  // ----------------------------------------------------
  // 7. 수강 계획서(플래너) 제어 - 5개 정원 슬롯 로직
  // ----------------------------------------------------
  window.togglePlannerSubject = function(id) {
    const sub = SUBJECTS_DATA.find(s => s.id === id);
    if (!sub) return;

    const existingIdx = state.selectedSubjects.findIndex(item => item.id === id);

    // 이미 담겨 있으면 삭제
    if (existingIdx >= 0) {
      state.selectedSubjects.splice(existingIdx, 1);
      showToast(`'${sub.name}' 과목을 수강 목록에서 제외했습니다.`, "info");
    } else {
      // 신규 추가: 해당 학기 5개 초과 여부 검사
      const currentSemCount = state.selectedSubjects.filter(s => s.semester === sub.semester).length;
      if (currentSemCount >= MAX_PER_SEMESTER) {
        showToast(`⚠️ [${sub.semester}학기]는 최대 5개 과목까지만 선택 가능합니다! (현재 5/5 가득 참)`, "warning");
        return;
      }

      state.selectedSubjects.push({
        id: sub.id,
        semester: sub.semester,
        name: sub.name,
        group: sub.group,
        credits: sub.credits
      });
      showToast(`'${sub.name}' 과목을 ${sub.semester}학기에 담았습니다. (${currentSemCount + 1}/${MAX_PER_SEMESTER})`, "success");
    }

    savePlannerState();
    renderPlanner();
    renderCatalog();
    if (state.activeTab === "tab-major-finder") {
      renderMajorRecommendation();
    }
  };

  function savePlannerState() {
    localStorage.setItem("incheonAirportPlan", JSON.stringify(state.selectedSubjects));
    updateCartCount();
  }

  function updateCartCount() {
    cartCountBadge.textContent = state.selectedSubjects.length;
  }

  function renderPlanner() {
    const sem1Items = state.selectedSubjects.filter(s => s.semester === 1);
    const sem2Items = state.selectedSubjects.filter(s => s.semester === 2);

    // 헤더 카운트 및 프로그레스 바
    sem1Count.textContent = `${sem1Items.length} / ${MAX_PER_SEMESTER}`;
    sem2Count.textContent = `${sem2Items.length} / ${MAX_PER_SEMESTER}`;

    const sem1Pct = (sem1Items.length / MAX_PER_SEMESTER) * 100;
    const sem2Pct = (sem2Items.length / MAX_PER_SEMESTER) * 100;
    sem1ProgressBar.style.width = `${sem1Pct}%`;
    sem2ProgressBar.style.width = `${sem2Pct}%`;

    // 상태 배지
    if (sem1Items.length === MAX_PER_SEMESTER) {
      sem1StatusBadge.textContent = "5/5 완료 🎉";
      sem1StatusBadge.className = "status-pill completed";
    } else {
      sem1StatusBadge.textContent = `${sem1Items.length}/5 선택 중`;
      sem1StatusBadge.className = "status-pill waiting";
    }

    if (sem2Items.length === MAX_PER_SEMESTER) {
      sem2StatusBadge.textContent = "5/5 완료 🎉";
      sem2StatusBadge.className = "status-pill completed";
    } else {
      sem2StatusBadge.textContent = `${sem2Items.length}/5 선택 중`;
      sem2StatusBadge.className = "status-pill waiting";
    }

    // 1학기 5개 슬롯 렌더링
    renderSemesterSlots(sem1SelectedList, sem1Items, 1);

    // 2학기 5개 슬롯 렌더링
    renderSemesterSlots(sem2SelectedList, sem2Items, 2);

    renderPlannerDiagnosis();
    renderGroupBalance();
  }

  function renderSemesterSlots(container, items, semester) {
    let slotsHTML = '<div class="slots-container">';

    for (let i = 0; i < MAX_PER_SEMESTER; i++) {
      if (i < items.length) {
        const item = items[i];
        slotsHTML += `
          <div class="slot-card filled">
            <div class="slot-left">
              <span class="slot-num-badge">${i + 1}</span>
              <span class="badge-tag group">${item.group}</span>
              <span class="slot-subject-title">${item.name}</span>
            </div>
            <button class="btn-remove" onclick="togglePlannerSubject('${item.id}')">삭제 ✕</button>
          </div>
        `;
      } else {
        slotsHTML += `
          <div class="slot-card empty" onclick="switchToCatalogWithFilter(${semester})">
            <div class="slot-left">
              <span class="slot-num-badge">${i + 1}</span>
              <span>➕ ${semester}학기 과목을 선택하세요 (슬롯 ${i + 1}/5)</span>
            </div>
            <span style="font-size: 11.5px; color: var(--primary);">과목 선택 ➔</span>
          </div>
        `;
      }
    }

    slotsHTML += '</div>';
    container.innerHTML = slotsHTML;
  }

  window.switchToCatalogWithFilter = function(semester) {
    state.catalogFilterSem = semester.toString();
    semesterPills.forEach(p => {
      p.classList.toggle("active", p.getAttribute("data-sem") === semester.toString());
    });
    switchTab("tab-catalog");
    renderCatalog();
  };

  // 플래너 목표 학과 퀵 버튼 연결
  applySem1RecBtn.addEventListener("click", () => {
    const val = plannerTargetMajor.value;
    if (val) applySingleSemPack(val, 1);
  });

  applySem2RecBtn.addEventListener("click", () => {
    const val = plannerTargetMajor.value;
    if (val) applySingleSemPack(val, 2);
  });

  function renderPlannerDiagnosis() {
    const val = plannerTargetMajor.value;
    if (!val) {
      plannerQuickApplyWrap.style.display = "none";
      plannerDiagnosisResult.innerHTML = `
        <p class="text-muted">상단 드롭다운에서 목표 학과를 선택하시면 권장 과목 반영 여부를 실시간 진단합니다.</p>
      `;
      return;
    }

    plannerQuickApplyWrap.style.display = "block";

    const [catIdx, mIdx] = val.split("-").map(Number);
    const major = MAJOR_CATEGORIES[catIdx].majors[mIdx];
    if (!major) return;

    const allRecommendedInAirport = [
      ...major.incheonAirportMatching.sem1,
      ...major.incheonAirportMatching.sem2
    ];

    const mySelectedNames = state.selectedSubjects.map(s => s.name);
    const matchedSubjects = allRecommendedInAirport.filter(name => mySelectedNames.includes(name));
    const missingSubjects = allRecommendedInAirport.filter(name => !mySelectedNames.includes(name));

    const totalTarget = 10; // 1학기 5개 + 2학기 5개
    const matchRate = Math.min(100, Math.round((matchedSubjects.length / totalTarget) * 100));

    let evaluationBadge = "";
    if (matchRate >= 80) {
      evaluationBadge = `<span style="color:#16a34a; font-weight:700;">🌟 최우수 전공 적합성 달성! (${matchRate}%)</span>`;
    } else if (matchRate >= 50) {
      evaluationBadge = `<span style="color:#2563eb; font-weight:700;">👍 우수한 이수 계획입니다. (${matchRate}%)</span>`;
    } else {
      evaluationBadge = `<span style="color:#ea580c; font-weight:700;">⚠️ 주요 권장과목 추가 보완을 권장합니다. (${matchRate}%)</span>`;
    }

    plannerDiagnosisResult.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong>[${major.name}]</strong> 추천 10과목 중 <strong>${matchedSubjects.length}과목</strong> 반영
        <div class="match-meter">
          <div class="meter-fill" style="width: ${matchRate}%;"></div>
        </div>
        ${evaluationBadge}
      </div>

      <div style="font-size: 12.5px; margin-top: 10px;">
        <div style="color: #15803d; margin-bottom: 4px;">
          ✓ <strong>담긴 권장 과목:</strong> ${matchedSubjects.length > 0 ? matchedSubjects.join(", ") : "없음"}
        </div>
        ${missingSubjects.length > 0 ? `
          <div style="color: #b91c1c; margin-top: 6px;">
            ! <strong>미반영 추천 과목:</strong> ${missingSubjects.slice(0, 5).join(", ")}
          </div>
        ` : ''}
      </div>
      <div style="margin-top: 10px; font-size: 12px; background: white; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; line-height:1.5;">
        💡 <strong>전략 조언:</strong> ${major.incheonAirportMatching.strategy}
      </div>
    `;
  }

  function renderGroupBalance() {
    const counts = { "국어": 0, "수학": 0, "영어": 0, "사회": 0, "과학": 0, "기술·가정/정보": 0, "제2외국어": 0 };
    state.selectedSubjects.forEach(s => {
      if (counts[s.group] !== undefined) counts[s.group]++;
    });

    const maxVal = Math.max(...Object.values(counts), 1);

    plannerGroupBalance.innerHTML = Object.entries(counts).map(([group, cnt]) => {
      const pct = (cnt / maxVal) * 100;
      return `
        <div class="bar-item">
          <span class="bar-label">${group}</span>
          <div class="bar-track">
            <div class="bar-val" style="width: ${pct}%;"></div>
          </div>
          <span style="font-weight:700; width: 24px; text-align:right;">${cnt}</span>
        </div>
      `;
    }).join("");
  }

  clearPlanBtn.addEventListener("click", () => {
    if (confirm("선택한 1·2학기 수강 계획을 모두 초기화하시겠습니까?")) {
      state.selectedSubjects = [];
      localStorage.removeItem("incheonAirportPlan");
      updateCartCount();
      renderPlanner();
      renderCatalog();
      if (state.activeTab === "tab-major-finder") renderMajorRecommendation();
      showToast("수강 계획이 초기화되었습니다.", "info");
    }
  });

  printPlanBtn.addEventListener("click", () => {
    window.print();
  });

  // ----------------------------------------------------
  // 8. 2028 대입 가이드 과목 요약 테이블
  // ----------------------------------------------------
  function renderSummaryTable() {
    summaryTableBody.innerHTML = SUBJECTS_DATA.map(sub => `
      <tr>
        <td><strong>${sub.semester}학기</strong></td>
        <td><span class="badge-tag group">${sub.group}</span></td>
        <td><strong>${sub.name}</strong></td>
        <td>${sub.type}</td>
        <td><small>${sub.gradeType}</small></td>
        <td><small>${sub.majors.slice(0, 3).join(", ")} 등</small></td>
      </tr>
    `).join("");
  }

  // 초기화 실행
  initSimulator();
  renderCatalog();
  renderPlanner();
  renderSummaryTable();
  updateCartCount();
});

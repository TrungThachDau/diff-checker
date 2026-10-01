<script setup>
import { ref, computed } from 'vue'
import { computeDiff } from './utils/diffHelper.js'
import { sfx } from './utils/sound.js'

// State
const oldText = ref('')
const newText = ref('')
const diffMode = ref('words') // 'words' | 'chars' | 'lines'
const ignoreCase = ref(false)
const ignoreWhitespace = ref(false)
const showAllEol = ref(false) // Xem EOL cả ở các dòng khớp
const colorScheme = ref('all-red') // 'all-red' (tô đỏ chỗ khác) | 'classic' (đỏ cũ, xanh mới)
const activeView = ref('diff') // 'diff' | 'edit'
const soundEnabled = ref(true)

// Panel Scroll Sync References
const leftScrollRef = ref(null)
const rightScrollRef = ref(null)
let isSyncingScroll = false

function toggleSound() {
  soundEnabled.value = !soundEnabled.value
  sfx.enabled = soundEnabled.value
  if (soundEnabled.value) {
    sfx.playPop()
  }
}

// Compute Diff (mặc định luôn luôn so sánh nghiêm ngặt cả CRLF và LF)
const diffResult = computed(() => {
  return computeDiff(oldText.value, newText.value, {
    mode: diffMode.value,
    ignoreCase: ignoreCase.value,
    ignoreWhitespace: ignoreWhitespace.value
  })
})

const stats = computed(() => diffResult.value.stats)

// Parse chunk value to render text and EOL badges
function parseChunkParts(val, isDiff) {
  if (!val) return []
  const parts = []
  const regex = /(\r\n|\r|\n)/g
  let lastIdx = 0
  let match
  while ((match = regex.exec(val)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', text: val.slice(lastIdx, match.index) })
    }
    const raw = match[0]
    const eolType = raw === '\r\n' ? 'CRLF' : raw === '\n' ? 'LF' : 'CR'
    parts.push({
      type: 'eol',
      eolType,
      raw,
      isDiff
    })
    lastIdx = regex.lastIndex
  }
  if (lastIdx < val.length) {
    parts.push({ type: 'text', text: val.slice(lastIdx) })
  }
  return parts
}

// Swap texts
function swapTexts() {
  sfx.playSwoosh()
  const temp = oldText.value
  oldText.value = newText.value
  newText.value = temp
}

// Clear all
function clearTexts() {
  sfx.playAlert()
  oldText.value = ''
  newText.value = ''
}

// Convert EOL helper
function convertEol(target, toType) {
  sfx.playPop()
  if (target === 'old') {
    if (toType === 'LF') {
      oldText.value = oldText.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    } else if (toType === 'CRLF') {
      oldText.value = oldText.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n')
    }
  } else {
    if (toType === 'LF') {
      newText.value = newText.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    } else if (toType === 'CRLF') {
      newText.value = newText.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n')
    }
  }
}

// Copy to clipboard
async function copyText(text, side) {
  sfx.playPop()
  try {
    await navigator.clipboard.writeText(text)
    alert(`Đã sao chép nội dung văn bản ${side}!`)
  } catch {
    // fallback
  }
}

// Handle file upload
function handleFileUpload(event, target) {
  const file = event.target.files?.[0]
  if (!file) return
  sfx.playPop()
  const reader = new FileReader()
  reader.onload = (e) => {
    if (target === 'old') {
      oldText.value = e.target.result
    } else {
      newText.value = e.target.result
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

// Synchronized scrolling
function handleScroll(source) {
  if (isSyncingScroll) return
  isSyncingScroll = true

  const sourceEl = source === 'left' ? leftScrollRef.value : rightScrollRef.value
  const targetEl = source === 'left' ? rightScrollRef.value : leftScrollRef.value

  if (sourceEl && targetEl) {
    const scrollPercentage = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1)
    targetEl.scrollTop = scrollPercentage * (targetEl.scrollHeight - targetEl.clientHeight)
  }

  requestAnimationFrame(() => {
    isSyncingScroll = false
  })
}

// Trigger comparison sound
function triggerCheck() {
  if (stats.value.isExactMatch && (oldText.value || newText.value)) {
    sfx.playSuccess()
  } else {
    sfx.playPop()
  }
}
</script>

<template>
  <div class="duo-app">
    <!-- TOP NAVIGATION BAR -->
    <header class="duo-header">
      <div class="header-container">
        <!-- Brand Logo -->
        <div class="brand-logo">
          <div class="brand-icon">
            <svg viewBox="0 0 36 36" width="34" height="34" fill="none">
              <rect width="36" height="36" rx="10" fill="#58cc02" />
              <rect x="6" y="8" width="10" height="20" rx="3" fill="#ffffff" />
              <rect x="20" y="8" width="10" height="20" rx="3" fill="#ffffff" />
              <!-- Red diff mark on left -->
              <rect x="8" y="14" width="6" height="3" rx="1.5" fill="#ff4b4b" />
              <!-- Red diff mark on right -->
              <rect x="22" y="14" width="6" height="3" rx="1.5" fill="#ff4b4b" />
              <!-- Unchanged lines -->
              <rect x="8" y="19" width="6" height="2" rx="1" fill="#c0c0c0" />
              <rect x="22" y="19" width="6" height="2" rx="1" fill="#c0c0c0" />
              <rect x="8" y="23" width="6" height="2" rx="1" fill="#c0c0c0" />
              <rect x="22" y="23" width="6" height="2" rx="1" fill="#c0c0c0" />
            </svg>
          </div>
          <span class="brand-name">Diff<span class="brand-diff">Checker</span></span>
          <span class="brand-badge">PRO</span>
        </div>

        <!-- Status & Tools -->
        <div class="status-bar">
          <!-- EOL Mismatch Warning Pill -->
          <div
            v-if="stats.isEolMismatch"
            class="status-pill eol-warning-pill"
            :title="`Bên trái dùng ${stats.oldEol}, bên phải dùng ${stats.newEol}. Khác biệt xuống dòng được tô đỏ trực tiếp.`"
          >
            <span class="status-dot red-dot"></span>
            <span class="status-label">LỆCH EOL:</span>
            <span class="status-num text-red">{{ stats.oldEol }} ≢ {{ stats.newEol }}</span>
          </div>

          <!-- Diff Status Pill -->
          <div
            v-if="stats.diffCount > 0"
            class="status-pill diff-status-pill"
            title="Số điểm khác biệt tìm thấy (bao gồm cả khác biệt ký tự và xuống dòng)"
          >
            <span class="status-dot red-dot"></span>
            <span class="status-label">KHÁC BIỆT:</span>
            <span class="status-num text-red">{{ stats.diffCount }}</span>
          </div>

          <!-- Similarity Pill -->
          <div
            v-if="oldText || newText"
            class="status-pill match-status-pill"
            title="Tỷ lệ trùng khớp giữa 2 văn bản (chỉ đạt 100% khi khớp cả nội dung lẫn CRLF/LF)"
          >
            <span class="status-dot green-dot"></span>
            <span class="status-label">TRÙNG KHỚP:</span>
            <span class="status-num text-green">{{ stats.similarityPercent }}%</span>
          </div>

          <!-- Sound Toggle Button -->
          <button
            class="sound-btn"
            :class="{ active: soundEnabled }"
            @click="toggleSound"
            :title="soundEnabled ? 'Tắt hiệu ứng âm thanh' : 'Bật hiệu ứng âm thanh'"
          >
            <span>{{ soundEnabled ? '🔊' : '🔇' }}</span>
          </button>
        </div>
      </div>
    </header>

    <main class="main-content">
      <!-- CONTROL TOOLBAR -->
      <section class="toolbar-section">
        <div class="toolbar-card duo-card">
          <!-- Left: View Mode Tabs -->
          <div class="tool-group">
            <span class="group-title">CHẾ ĐỘ XEM:</span>
            <div class="segmented-control">
              <button
                class="segment-btn"
                :class="{ active: activeView === 'diff' }"
                @click="activeView = 'diff'; sfx.playPop()"
              >
                <span class="btn-icon">🔍</span>
                <span>So sánh tô đỏ</span>
              </button>
              <button
                class="segment-btn"
                :class="{ active: activeView === 'edit' }"
                @click="activeView = 'edit'; sfx.playPop()"
              >
                <span class="btn-icon">✏️</span>
                <span>Chỉnh sửa văn bản</span>
              </button>
            </div>
          </div>

          <!-- Middle: Diff Granularity -->
          <div class="tool-group">
            <span class="group-title">MỨC SO SÁNH:</span>
            <div class="segmented-control">
              <button
                class="segment-btn"
                :class="{ active: diffMode === 'words' }"
                @click="diffMode = 'words'; sfx.playPop()"
                title="So sánh chi tiết từng từ & khoảng trắng/xuống dòng"
              >
                Từng từ
              </button>
              <button
                class="segment-btn"
                :class="{ active: diffMode === 'chars' }"
                @click="diffMode = 'chars'; sfx.playPop()"
                title="So sánh chi tiết từng ký tự & từng byte EOL"
              >
                Từng ký tự
              </button>
              <button
                class="segment-btn"
                :class="{ active: diffMode === 'lines' }"
                @click="diffMode = 'lines'; sfx.playPop()"
                title="So sánh từng dòng"
              >
                Từng dòng
              </button>
            </div>
          </div>

          <!-- Color Style -->
          <div class="tool-group">
            <span class="group-title">KIỂU TÔ MÀU:</span>
            <div class="segmented-control">
              <button
                class="segment-btn red-mode"
                :class="{ active: colorScheme === 'all-red' }"
                @click="colorScheme = 'all-red'; sfx.playPop()"
                title="Tô đỏ tất cả điểm khác biệt ở cả 2 bên theo yêu cầu"
              >
                🔴 Tô đỏ chỗ khác
              </button>
              <button
                class="segment-btn"
                :class="{ active: colorScheme === 'classic' }"
                @click="colorScheme = 'classic'; sfx.playPop()"
                title="Đỏ (text cũ đã bỏ) & Xanh (text mới thêm)"
              >
                🔴 Cũ / 🟢 Mới
              </button>
            </div>
          </div>

          <!-- Optional: Show All EOL tags toggle -->
          <div class="tool-group">
            <button
              class="segment-btn"
              :class="{ active: showAllEol }"
              @click="showAllEol = !showAllEol; sfx.playPop()"
              title="Hiện thêm ký hiệu CRLF/LF ở cả các dòng khớp"
            >
              <span>{{ showAllEol ? '👁️ Ẩn EOL dòng khớp' : '👁️ Hiện EOL cả bài' }}</span>
            </button>
          </div>

          <!-- Right: Action Buttons -->
          <div class="tool-actions">
            <button
              class="duo-btn duo-btn-outline duo-btn-sm"
              @click="swapTexts"
              title="Đổi chỗ văn bản cũ và mới"
            >
              ⇄ Đổi bên
            </button>
            <button
              class="duo-btn duo-btn-outline duo-btn-sm"
              @click="clearTexts"
              title="Xóa trắng cả 2 bên"
            >
              🗑️ Xóa hết
            </button>
          </div>
        </div>
      </section>

      <!-- MAIN SPLIT VIEW (2 COLUMNS: BÊN TRÁI TEXT CŨ, BÊN PHẢI TEXT MỚI) -->
      <section class="diff-split-container">
        <!-- LEFT COLUMN: TEXT CŨ (ORIGINAL) -->
        <div class="diff-column left-column duo-card">
          <!-- Header -->
          <div class="column-header">
            <div class="column-title-group">
              <div class="badge-tag tag-old">
                <span class="tag-dot"></span>
                <span>BÊN TRÁI: TEXT CŨ</span>
                <span
                  v-if="stats.oldEol !== 'None'"
                  class="eol-indicator"
                  :class="stats.oldEol.toLowerCase()"
                  :title="`Định dạng xuống dòng bên trái: ${stats.oldEol}`"
                >
                  {{ stats.oldEol }}
                </span>
              </div>
              <span class="sub-info">
                {{ stats.oldWords }} từ • {{ stats.oldLines }} dòng • {{ stats.oldLength }} ký tự
              </span>
            </div>

            <div class="column-tools">
              <!-- EOL Convert buttons -->
              <div v-if="stats.oldEol !== 'None'" class="eol-convert-group">
                <button
                  v-if="stats.oldEol !== 'LF'"
                  class="icon-action-btn btn-mini"
                  @click="convertEol('old', 'LF')"
                  title="Chuyển tất cả xuống dòng của bên trái sang LF (Unix)"
                >
                  ➜ LF
                </button>
                <button
                  v-if="stats.oldEol !== 'CRLF'"
                  class="icon-action-btn btn-mini"
                  @click="convertEol('old', 'CRLF')"
                  title="Chuyển tất cả xuống dòng của bên trái sang CRLF (Windows)"
                >
                  ➜ CRLF
                </button>
              </div>

              <label class="icon-action-btn" title="Tải file .txt, .md, .js...">
                📁 Tải file
                <input
                  type="file"
                  accept=".txt,.md,.js,.json,.html,.css,.vue"
                  class="hidden-file-input"
                  @change="handleFileUpload($event, 'old')"
                />
              </label>
              <button
                class="icon-action-btn"
                @click="copyText(oldText, 'cũ')"
                title="Sao chép văn bản cũ"
              >
                📋 Sao chép
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="column-body">
            <!-- Edit Mode: Textarea (JetBrains Mono) -->
            <textarea
              v-show="activeView === 'edit'"
              v-model="oldText"
              class="duo-textarea old-textarea"
              placeholder="Nhập hoặc dán văn bản cũ vào đây..."
              spellcheck="false"
            ></textarea>

            <!-- Diff View: Red Highlighted Stream (JetBrains Mono) -->
            <div
              v-show="activeView === 'diff'"
              ref="leftScrollRef"
              class="diff-stream-view"
              @scroll="handleScroll('left')"
            >
              <div v-if="!oldText" class="empty-diff-placeholder">
                <span class="placeholder-icon">📝</span>
                <p class="placeholder-main">Chưa có văn bản cũ</p>
                <p class="placeholder-sub">
                  Dán text vào đây hoặc chuyển sang tab <b>"Chỉnh sửa văn bản"</b> để nhập.
                </p>
              </div>
              <div v-else class="diff-text-flow">
                <template v-for="chunk in diffResult.leftChunks" :key="chunk.id">
                  <!-- Highlighted Removed/Different Chunk (TÔ ĐỎ Ở CHỖ KHÁC, KỂ CẢ CRLF/LF) -->
                  <span
                    v-if="chunk.isDiff"
                    class="diff-chunk diff-removed"
                    :title="`Đã thay đổi / bị xóa: '${chunk.value}'`"
                  >
                    <span class="diff-sign">-</span>
                    <template v-for="(part, pIdx) in parseChunkParts(chunk.value, true)" :key="pIdx">
                      <span v-if="part.type === 'text'" class="diff-val">{{ part.text }}</span>
                      <span
                        v-else
                        class="eol-badge-diff"
                        :class="part.eolType.toLowerCase()"
                        :title="`Khác biệt EOL: '${part.eolType}'`"
                      >
                        <span class="eol-icon">↵</span>{{ part.eolType }}
                      </span>
                      <span v-if="part.raw.includes('\n')">{{ '\n' }}</span>
                    </template>
                  </span>

                  <!-- Unchanged Chunk -->
                  <span v-else class="diff-chunk diff-same">
                    <template v-for="(part, pIdx) in parseChunkParts(chunk.value, false)" :key="pIdx">
                      <span v-if="part.type === 'text'">{{ part.text }}</span>
                      <template v-else>
                        <span
                          v-if="showAllEol"
                          class="eol-badge-same"
                          :class="part.eolType.toLowerCase()"
                        >
                          <span class="eol-icon">↵</span>{{ part.eolType }}
                        </span>
                        <span v-if="part.raw.includes('\n')">{{ '\n' }}</span>
                      </template>
                    </template>
                  </span>
                </template>
              </div>
            </div>
          </div>

          <!-- Column Footer -->
          <div class="column-footer">
            <span class="column-footer-text">
              <span class="diff-indicator-badge red"></span>
              Tô đỏ chữ hoặc ký tự xuống dòng (CRLF/LF) bị xóa hoặc sửa đổi
            </span>
          </div>
        </div>

        <!-- RIGHT COLUMN: TEXT MỚI (NEW) -->
        <div class="diff-column right-column duo-card">
          <!-- Header -->
          <div class="column-header">
            <div class="column-title-group">
              <div class="badge-tag tag-new">
                <span class="tag-dot"></span>
                <span>BÊN PHẢI: TEXT MỚI</span>
                <span
                  v-if="stats.newEol !== 'None'"
                  class="eol-indicator"
                  :class="stats.newEol.toLowerCase()"
                  :title="`Định dạng xuống dòng bên phải: ${stats.newEol}`"
                >
                  {{ stats.newEol }}
                </span>
              </div>
              <span class="sub-info">
                {{ stats.newWords }} từ • {{ stats.newLines }} dòng • {{ stats.newLength }} ký tự
              </span>
            </div>

            <div class="column-tools">
              <!-- EOL Convert buttons -->
              <div v-if="stats.newEol !== 'None'" class="eol-convert-group">
                <button
                  v-if="stats.newEol !== 'LF'"
                  class="icon-action-btn btn-mini"
                  @click="convertEol('new', 'LF')"
                  title="Chuyển tất cả xuống dòng của bên phải sang LF (Unix)"
                >
                  ➜ LF
                </button>
                <button
                  v-if="stats.newEol !== 'CRLF'"
                  class="icon-action-btn btn-mini"
                  @click="convertEol('new', 'CRLF')"
                  title="Chuyển tất cả xuống dòng của bên phải sang CRLF (Windows)"
                >
                  ➜ CRLF
                </button>
              </div>

              <label class="icon-action-btn" title="Tải file .txt, .md, .js...">
                📁 Tải file
                <input
                  type="file"
                  accept=".txt,.md,.js,.json,.html,.css,.vue"
                  class="hidden-file-input"
                  @change="handleFileUpload($event, 'new')"
                />
              </label>
              <button
                class="icon-action-btn"
                @click="copyText(newText, 'mới')"
                title="Sao chép văn bản mới"
              >
                📋 Sao chép
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="column-body">
            <!-- Edit Mode: Textarea (JetBrains Mono) -->
            <textarea
              v-show="activeView === 'edit'"
              v-model="newText"
              class="duo-textarea new-textarea"
              placeholder="Nhập hoặc dán văn bản mới vào đây..."
              spellcheck="false"
            ></textarea>

            <!-- Diff View: Red Highlighted Stream (JetBrains Mono) -->
            <div
              v-show="activeView === 'diff'"
              ref="rightScrollRef"
              class="diff-stream-view"
              @scroll="handleScroll('right')"
            >
              <div v-if="!newText" class="empty-diff-placeholder">
                <span class="placeholder-icon">📄</span>
                <p class="placeholder-main">Chưa có văn bản mới</p>
                <p class="placeholder-sub">
                  Dán text vào đây hoặc chuyển sang tab <b>"Chỉnh sửa văn bản"</b> để nhập.
                </p>
              </div>
              <div v-else class="diff-text-flow">
                <template v-for="chunk in diffResult.rightChunks" :key="chunk.id">
                  <!-- Highlighted Added/Different Chunk (TÔ ĐỎ THEO YÊU CẦU HOẶC XANH NẾU CLASSIC) -->
                  <span
                    v-if="chunk.isDiff"
                    :class="[
                      'diff-chunk',
                      colorScheme === 'all-red' ? 'diff-removed' : 'diff-added'
                    ]"
                    :title="`Khác biệt / thêm mới: '${chunk.value}'`"
                  >
                    <span class="diff-sign">+</span>
                    <template v-for="(part, pIdx) in parseChunkParts(chunk.value, true)" :key="pIdx">
                      <span v-if="part.type === 'text'" class="diff-val">{{ part.text }}</span>
                      <span
                        v-else
                        class="eol-badge-diff"
                        :class="part.eolType.toLowerCase()"
                        :title="`Khác biệt EOL: '${part.eolType}'`"
                      >
                        <span class="eol-icon">↵</span>{{ part.eolType }}
                      </span>
                      <span v-if="part.raw.includes('\n')">{{ '\n' }}</span>
                    </template>
                  </span>

                  <!-- Unchanged Chunk -->
                  <span v-else class="diff-chunk diff-same">
                    <template v-for="(part, pIdx) in parseChunkParts(chunk.value, false)" :key="pIdx">
                      <span v-if="part.type === 'text'">{{ part.text }}</span>
                      <template v-else>
                        <span
                          v-if="showAllEol"
                          class="eol-badge-same"
                          :class="part.eolType.toLowerCase()"
                        >
                          <span class="eol-icon">↵</span>{{ part.eolType }}
                        </span>
                        <span v-if="part.raw.includes('\n')">{{ '\n' }}</span>
                      </template>
                    </template>
                  </span>
                </template>
              </div>
            </div>
          </div>

          <!-- Column Footer -->
          <div class="column-footer">
            <span class="column-footer-text">
              <span
                class="diff-indicator-badge"
                :class="colorScheme === 'all-red' ? 'red' : 'green'"
              ></span>
              {{
                colorScheme === 'all-red'
                  ? 'Tô đỏ chữ hoặc ký tự xuống dòng (CRLF/LF) mới được thêm hoặc thay thế'
                  : 'Tô xanh chữ hoặc ký tự xuống dòng (CRLF/LF) mới được thêm hoặc thay thế'
              }}
            </span>
          </div>
        </div>
      </section>
    </main>

    <!-- DUOLINGO STYLED BOTTOM ACTION BAR -->
    <footer class="duo-bottom-bar">
      <div class="bottom-container">
        <!-- Left: Similarity meter & Duolingo Progress bar -->
        <div class="metric-block">
          <div class="metric-header">
            <span class="metric-title">TỶ LỆ TƯƠNG ĐỒNG:</span>
            <span class="metric-val" :class="{ 'val-perfect': stats.similarityPercent === 100 }">
              {{ stats.similarityPercent }}%
            </span>
          </div>
          <div class="duo-progress-track">
            <div
              class="duo-progress-fill"
              :style="{ width: `${stats.similarityPercent}%` }"
              :class="{
                'progress-gold': stats.similarityPercent === 100,
                'progress-normal': stats.similarityPercent < 100
              }"
            >
              <div class="progress-shine"></div>
            </div>
          </div>
        </div>

        <!-- Center: Highlights count summary -->
        <div class="summary-pills">
          <div class="diff-summary-card red">
            <span class="summary-label">ĐIỂM KHÁC BIỆT</span>
            <span class="summary-num">{{ stats.diffCount }}</span>
          </div>
          <div class="diff-summary-card green">
            <span class="summary-label">ĐÃ KHỚP</span>
            <span class="summary-num">{{ stats.similarityPercent }}%</span>
          </div>
        </div>

        <!-- Right: Check / Action Button -->
        <div class="main-action">
          <button
            class="duo-btn duo-btn-green check-btn"
            @click="triggerCheck"
          >
            <span>✨ SO SÁNH / KIỂM TRA</span>
          </button>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.duo-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f7f7f7;
  padding-bottom: 96px; /* space for fixed bottom bar */
}

/* HEADER */
.duo-header {
  background-color: #ffffff;
  border-bottom: 2px solid var(--duo-gray-border);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.header-container {
  max-width: 1320px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-name {
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.5px;
  color: var(--duo-green);
}

.brand-diff {
  color: var(--duo-blue);
}

.brand-badge {
  background-color: var(--duo-yellow);
  color: #795548;
  font-size: 11px;
  font-weight: 900;
  padding: 3px 8px;
  border-radius: 8px;
  border-bottom: 2px solid var(--duo-yellow-dark);
  letter-spacing: 0.5px;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: 14px;
  font-weight: 800;
  font-size: 13px;
  border: 2px solid var(--duo-gray-border);
  background-color: #ffffff;
}

.eol-warning-pill {
  border-color: #ffd8d8;
  background-color: #fff5f5;
}

.diff-status-pill {
  border-color: #ffd8d8;
  background-color: #fff8f8;
}

.match-status-pill {
  border-color: #d2f6ba;
  background-color: #f7fff2;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.red-dot {
  background-color: var(--duo-red);
}
.green-dot {
  background-color: var(--duo-green);
}

.status-label {
  font-size: 11px;
  color: var(--duo-text-muted);
  font-weight: 800;
}

.status-num {
  font-size: 14px;
  font-weight: 900;
}
.text-red {
  color: var(--duo-red);
}
.text-green {
  color: var(--duo-green-dark);
}

.sound-btn {
  background: #ffffff;
  border: 2px solid var(--duo-gray-border);
  border-bottom: 3px solid var(--duo-gray-border);
  border-radius: 14px;
  padding: 7px 12px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.1s ease;
}
.sound-btn:active {
  transform: translateY(2px);
  border-bottom-width: 1px;
}

/* MAIN CONTENT */
.main-content {
  max-width: 1320px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* TOOLBAR */
.toolbar-card {
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  background-color: #ffffff;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-title {
  font-size: 12px;
  font-weight: 900;
  color: var(--duo-text-muted);
  letter-spacing: 0.6px;
}

.segmented-control {
  display: inline-flex;
  background-color: #f0f0f0;
  border-radius: 14px;
  padding: 3px;
  border: 1px solid var(--duo-gray-border);
}

.segment-btn {
  border: none;
  background: transparent;
  padding: 7px 15px;
  border-radius: 11px;
  font-family: var(--duo-font);
  font-size: 13px;
  font-weight: 800;
  color: var(--duo-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.segment-btn.active {
  background-color: #ffffff;
  color: var(--duo-text-dark);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.segment-btn.red-mode.active {
  color: var(--duo-red);
}

.tool-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* SPLIT 2-COLUMN COMPARISON */
.diff-split-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.diff-column {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  overflow: hidden;
  height: 600px;
}

.column-header {
  padding: 14px 18px;
  border-bottom: 2px solid var(--duo-gray-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fafafa;
}

.column-title-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.5px;
  padding: 4px 12px;
  border-radius: 12px;
}

.tag-old {
  background-color: var(--duo-red-light);
  color: var(--duo-red-dark);
  border: 1.5px solid #ffb8b8;
}

.tag-new {
  background-color: var(--duo-blue-light);
  color: var(--duo-blue-dark);
  border: 1.5px solid #a8e4ff;
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: currentColor;
}

/* EOL Badges in header */
.eol-indicator {
  font-size: 10px;
  font-family: var(--duo-font-mono);
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}
.eol-indicator.crlf {
  background-color: #e7f5ff;
  color: #1971c2;
  border: 1px solid #a5d8ff;
}
.eol-indicator.lf {
  background-color: #ebfbee;
  color: #2b8a3e;
  border: 1px solid #b2f2bb;
}
.eol-indicator.mixed {
  background-color: #fff3bf;
  color: #e67700;
  border: 1px solid #ffe066;
}

.sub-info {
  font-size: 12px;
  font-weight: 700;
  color: var(--duo-text-muted);
}

.column-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.eol-convert-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-mini {
  padding: 4px 8px !important;
  font-size: 11px !important;
}

.icon-action-btn {
  background-color: #ffffff;
  border: 1.5px solid var(--duo-gray-border);
  border-bottom: 2.5px solid var(--duo-gray-border);
  border-radius: 10px;
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 800;
  color: var(--duo-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.1s ease;
  user-select: none;
}
.icon-action-btn:hover {
  background-color: #f7f7f7;
  border-color: var(--duo-gray-border-dark);
}
.icon-action-btn:active {
  transform: translateY(1.5px);
  border-bottom-width: 1px;
}

.hidden-file-input {
  display: none;
}

/* COLUMN BODY */
.column-body {
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: #ffffff;
}

/* TEXTAREA WITH JETBRAINS MONO */
.duo-textarea {
  width: 100%;
  height: 100%;
  padding: 20px;
  border: none;
  outline: none;
  resize: none;
  font-family: var(--duo-font-mono);
  font-size: 14.5px;
  font-feature-settings: 'calt' 1, 'liga' 1;
  letter-spacing: -0.1px;
  tab-size: 2;
  line-height: 1.7;
  color: var(--duo-text);
  background-color: #ffffff;
}
.duo-textarea:focus {
  background-color: #fdfeff;
}

/* DIFF STREAM VIEW WITH JETBRAINS MONO */
.diff-stream-view {
  width: 100%;
  height: 100%;
  padding: 20px;
  overflow-y: auto;
  overflow-x: auto;
  font-family: var(--duo-font-mono);
  font-size: 14.5px;
  font-feature-settings: 'calt' 1, 'liga' 1;
  letter-spacing: -0.1px;
  tab-size: 2;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

.empty-diff-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--duo-text-muted);
  text-align: center;
  padding: 30px;
  font-family: var(--duo-font);
}

.placeholder-icon {
  font-size: 42px;
  margin-bottom: 10px;
}

.placeholder-main {
  font-size: 16px;
  font-weight: 800;
  color: var(--duo-text);
  margin-bottom: 4px;
}

.placeholder-sub {
  font-size: 13px;
  color: #999999;
  max-width: 320px;
}

.diff-text-flow {
  font-family: var(--duo-font-mono);
  font-weight: 500;
  color: #2b2b2b;
}

/* DIFF CHUNKS & HIGHLIGHTING */
.diff-chunk {
  display: inline;
  border-radius: 4px;
  transition: all 0.15s ease;
  font-family: var(--duo-font-mono);
}

.diff-same {
  color: #2b2b2b;
}

/* TÔ ĐỎ CHỖ KHÁC BIỆT (KỂ CẢ KÝ TỰ XUỐNG DÒNG) */
.diff-removed {
  background-color: #ffd9da !important;
  color: #c91818 !important;
  border-bottom: 2px solid #e02424;
  border-radius: 6px;
  padding: 1px 5px;
  margin: 0 1px;
  font-weight: 700 !important;
  box-shadow: 0 1px 2px rgba(234, 43, 43, 0.15);
}

.diff-removed .diff-sign {
  font-size: 11px;
  font-weight: 900;
  margin-right: 2px;
  opacity: 0.7;
}

/* CLASSIC GREEN FOR ADDED */
.diff-added {
  background-color: #d7f8c0 !important;
  color: #277700 !important;
  border-bottom: 2px solid #58cc02;
  border-radius: 6px;
  padding: 1px 5px;
  margin: 0 1px;
  font-weight: 700 !important;
  box-shadow: 0 1px 2px rgba(88, 204, 2, 0.15);
}

.diff-added .diff-sign {
  font-size: 11px;
  font-weight: 900;
  margin-right: 2px;
  opacity: 0.7;
}

/* EOL BADGES IN DIFF AND SAME */
.eol-badge-diff {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: var(--duo-font-mono);
  font-size: 9.5px;
  font-weight: 900;
  padding: 1px 5px;
  margin: 0 2px;
  border-radius: 4px;
  background-color: #ffc9c9;
  color: #a51d24;
  border: 1px solid #ff8787;
  user-select: none;
  vertical-align: middle;
  line-height: 1.2;
}

.eol-badge-same {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: var(--duo-font-mono);
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  margin: 0 2px;
  border-radius: 4px;
  background-color: #f1f3f5;
  color: #868e96;
  border: 1px solid #dee2e6;
  user-select: none;
  vertical-align: middle;
  line-height: 1.2;
}

.eol-icon {
  font-size: 10px;
  opacity: 0.8;
}

/* COLUMN FOOTER */
.column-footer {
  padding: 10px 18px;
  background-color: #fafafa;
  border-top: 2px solid var(--duo-gray-border);
  display: flex;
  align-items: center;
}

.column-footer-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--duo-text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-indicator-badge {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  display: inline-block;
}

.diff-indicator-badge.red {
  background-color: var(--duo-red);
}

.diff-indicator-badge.green {
  background-color: var(--duo-green);
}

/* FIXED BOTTOM ACTION BAR */
.duo-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #ffffff;
  border-top: 2px solid var(--duo-gray-border);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
  z-index: 99;
}

.bottom-container {
  max-width: 1320px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.metric-block {
  flex: 1;
  max-width: 320px;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.metric-title {
  font-size: 12px;
  font-weight: 900;
  color: var(--duo-text-muted);
  letter-spacing: 0.5px;
}

.metric-val {
  font-size: 15px;
  font-weight: 900;
  color: var(--duo-green-dark);
}

.metric-val.val-perfect {
  color: var(--duo-yellow-dark);
}

/* Progress Bar */
.duo-progress-track {
  height: 16px;
  background-color: #e5e5e5;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

.duo-progress-fill {
  height: 100%;
  border-radius: 10px;
  transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

.progress-normal {
  background-color: var(--duo-green);
}

.progress-gold {
  background-color: var(--duo-yellow);
}

.progress-shine {
  position: absolute;
  top: 3px;
  left: 6px;
  right: 6px;
  height: 4px;
  background-color: rgba(255, 255, 255, 0.4);
  border-radius: 4px;
}

.summary-pills {
  display: flex;
  align-items: center;
  gap: 12px;
}

.diff-summary-card {
  padding: 6px 16px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 2px solid;
}

.diff-summary-card.red {
  background-color: #fff2f2;
  border-color: #ffd4d4;
  color: var(--duo-red-dark);
}

.diff-summary-card.green {
  background-color: #f2fde9;
  border-color: #d6f6c2;
  color: var(--duo-green-dark);
}

.summary-label {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.5px;
  opacity: 0.8;
}

.summary-num {
  font-size: 18px;
  font-weight: 900;
  line-height: 1.1;
}

.check-btn {
  min-width: 200px;
}

/* Responsive adjustments */
@media (max-width: 900px) {
  .diff-split-container {
    grid-template-columns: 1fr;
  }
  .diff-column {
    height: 420px;
  }
  .bottom-container {
    flex-direction: column;
    gap: 12px;
  }
  .metric-block {
    max-width: 100%;
    width: 100%;
  }
  .check-btn {
    width: 100%;
  }
}
</style>

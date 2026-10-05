<script setup>
import { ref, computed, nextTick } from 'vue'
import { computeDiff } from './utils/diffHelper.js'

// State
const oldText = ref('')
const newText = ref('')
const diffMode = ref('words') // 'words' | 'chars' | 'lines'
const ignoreCase = ref(false)
const ignoreWhitespace = ref(false)
const showAllEol = ref(false) // Xem EOL cả ở các dòng khớp
const colorScheme = ref('all-red') // 'all-red' (tô đỏ chỗ khác) | 'classic' (đỏ cũ, xanh mới)

// Independent edit state per column (default to edit if text is empty)
const isEditingOld = ref(true)
const isEditingNew = ref(true)

// DOM references
const oldTextareaRef = ref(null)
const newTextareaRef = ref(null)
const leftScrollRef = ref(null)
const rightScrollRef = ref(null)
let isSyncingScroll = false

// Copy feedback state
const copiedOld = ref(false)
const copiedNew = ref(false)

// Compute Diff (mặc định luôn so sánh nghiêm ngặt cả CRLF và LF)
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
      parts.push({ type: 'text', text: val.slice(lastIdx, match.index), raw: '' })
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
    parts.push({ type: 'text', text: val.slice(lastIdx), raw: '' })
  }
  return parts
}

// onBlur (focus out): tự động so sánh khi rời khỏi ô soạn thảo
function onTextareaBlur(side) {
  setTimeout(() => {
    if (side === 'old' && oldText.value) {
      isEditingOld.value = false
    } else if (side === 'new' && newText.value) {
      isEditingNew.value = false
    }
  }, 100)
}

// Start editing on click
function startEditing(side) {
  if (side === 'old') {
    isEditingOld.value = true
    nextTick(() => {
      oldTextareaRef.value?.focus()
    })
  } else {
    isEditingNew.value = true
    nextTick(() => {
      newTextareaRef.value?.focus()
    })
  }
}

function onDiffClick(side) {
  // Không chuyển chế độ nếu người dùng đang bôi đen (select) văn bản để sao chép
  const selection = window.getSelection()
  if (selection && selection.toString().length > 0) {
    return
  }
  startEditing(side)
}

function toggleEdit(side) {
  if (side === 'old') {
    isEditingOld.value = !isEditingOld.value
    if (isEditingOld.value) {
      nextTick(() => oldTextareaRef.value?.focus())
    }
  } else {
    isEditingNew.value = !isEditingNew.value
    if (isEditingNew.value) {
      nextTick(() => newTextareaRef.value?.focus())
    }
  }
}

// Toolbar controls: chuyển ngay sang chế độ xem diff khi đổi thiết lập
function setDiffMode(mode) {
  diffMode.value = mode
  if (oldText.value) isEditingOld.value = false
  if (newText.value) isEditingNew.value = false
}

function setColorScheme(scheme) {
  colorScheme.value = scheme
  if (oldText.value) isEditingOld.value = false
  if (newText.value) isEditingNew.value = false
}

function toggleShowAllEol() {
  showAllEol.value = !showAllEol.value
  if (oldText.value) isEditingOld.value = false
  if (newText.value) isEditingNew.value = false
}

// Swap texts
function swapTexts() {
  const temp = oldText.value
  oldText.value = newText.value
  newText.value = temp
  if (oldText.value) isEditingOld.value = false
  if (newText.value) isEditingNew.value = false
}

// Clear all
function clearTexts() {
  oldText.value = ''
  newText.value = ''
  isEditingOld.value = true
  isEditingNew.value = true
}

// Convert EOL helper
function convertEol(target, toType) {
  if (target === 'old') {
    if (toType === 'LF') {
      oldText.value = oldText.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    } else if (toType === 'CRLF') {
      oldText.value = oldText.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n')
    }
    isEditingOld.value = false
  } else {
    if (toType === 'LF') {
      newText.value = newText.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    } else if (toType === 'CRLF') {
      newText.value = newText.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n')
    }
    isEditingNew.value = false
  }
}

// Copy to clipboard with inline feedback
async function copyText(text, side) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    if (side === 'old') {
      copiedOld.value = true
      setTimeout(() => {
        copiedOld.value = false
      }, 1500)
    } else {
      copiedNew.value = true
      setTimeout(() => {
        copiedNew.value = false
      }, 1500)
    }
  } catch {
    // fallback
  }
}

// Handle file upload
function handleFileUpload(event, target) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    if (target === 'old') {
      oldText.value = e.target.result
      isEditingOld.value = false
    } else {
      newText.value = e.target.result
      isEditingNew.value = false
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

// Synchronized scrolling for diff views
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
</script>

<template>
  <div class="diff-app">
    <!-- TOP NAVIGATION BAR -->
    <header class="app-header">
      <div class="header-container">
        <!-- Brand Logo -->
        <div class="brand-logo">
          <div class="brand-icon">
            <svg viewBox="0 0 36 36" width="32" height="32" fill="none">
              <rect width="36" height="36" rx="8" fill="#58cc02" />
              <rect x="6" y="8" width="10" height="20" rx="2" fill="#ffffff" />
              <rect x="20" y="8" width="10" height="20" rx="2" fill="#ffffff" />
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
        </div>

        <!-- Status Metrics -->
        <div class="status-bar">
          <!-- EOL Mismatch Warning Pill -->
          <div
            v-if="stats.isEolMismatch"
            class="status-pill eol-warning-pill"
            :title="`Bên trái dùng ${stats.oldEol}, bên phải dùng ${stats.newEol}. Khác biệt xuống dòng được đánh dấu rõ ràng.`"
          >
            <span class="status-dot red-dot"></span>
            <span class="status-label">LỆCH EOL:</span>
            <span class="status-num text-red">{{ stats.oldEol }} ≢ {{ stats.newEol }}</span>
          </div>

          <!-- Diff Status Pill -->
          <div
            v-if="stats.diffCount > 0"
            class="status-pill diff-status-pill"
            title="Số điểm khác biệt tìm thấy"
          >
            <span class="status-dot red-dot"></span>
            <span class="status-label">KHÁC BIỆT:</span>
            <span class="status-num text-red">{{ stats.diffCount }}</span>
          </div>

          <!-- Similarity Pill -->
          <div
            v-if="oldText || newText"
            class="status-pill match-status-pill"
            title="Tỷ lệ trùng khớp giữa 2 văn bản"
          >
            <span class="status-dot green-dot"></span>
            <span class="status-label">TRÙNG KHỚP:</span>
            <span class="status-num text-green">{{ stats.similarityPercent }}%</span>
          </div>
        </div>
      </div>
    </header>

    <main class="main-content">
      <!-- CONTROL TOOLBAR -->
      <section class="toolbar-section">
        <div class="toolbar-card duo-card">
          <!-- Diff Granularity -->
          <div class="tool-group">
            <span class="group-title">MỨC SO SÁNH:</span>
            <div class="segmented-control">
              <button
                class="segment-btn"
                :class="{ active: diffMode === 'words' }"
                @click="setDiffMode('words')"
                title="So sánh chi tiết từng từ & khoảng trắng/xuống dòng"
              >
                Từng từ
              </button>
              <button
                class="segment-btn"
                :class="{ active: diffMode === 'chars' }"
                @click="setDiffMode('chars')"
                title="So sánh chi tiết từng ký tự & từng byte EOL"
              >
                Từng ký tự
              </button>
              <button
                class="segment-btn"
                :class="{ active: diffMode === 'lines' }"
                @click="setDiffMode('lines')"
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
                @click="setColorScheme('all-red')"
                title="Tô đỏ tất cả điểm khác biệt ở cả 2 bên"
              >
                🔴 Tô đỏ chỗ khác
              </button>
              <button
                class="segment-btn"
                :class="{ active: colorScheme === 'classic' }"
                @click="setColorScheme('classic')"
                title="Đỏ (text cũ bỏ) & Xanh (text mới thêm)"
              >
                🔴 Cũ / 🟢 Mới
              </button>
            </div>
          </div>

          <!-- Show All EOL tags toggle -->
          <div class="tool-group">
            <button
              class="segment-btn"
              :class="{ active: showAllEol }"
              @click="toggleShowAllEol"
              title="Hiện thêm ký hiệu CRLF/LF ở cả các dòng khớp"
            >
              <span>{{ showAllEol ? '👁️ Ẩn EOL dòng khớp' : '👁️ Hiện EOL cả bài' }}</span>
            </button>
          </div>

          <!-- Action Buttons -->
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

      <!-- MAIN SPLIT VIEW (2 COLUMNS) -->
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
              <!-- Mode indicator / Toggle button -->
              <button
                class="icon-action-btn btn-mode-toggle"
                @click="toggleEdit('old')"
                :title="isEditingOld ? 'Xem kết quả so sánh' : 'Bấm để chỉnh sửa văn bản'"
              >
                {{ isEditingOld ? '🔍 Xem so sánh' : '✏️ Chỉnh sửa' }}
              </button>

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

              <label class="icon-action-btn" title="Tải file văn bản (.txt, .md, .js...)">
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
                :class="{ 'btn-success': copiedOld }"
                @click="copyText(oldText, 'old')"
                title="Sao chép văn bản cũ"
              >
                {{ copiedOld ? '✓ Đã chép' : '📋 Sao chép' }}
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="column-body">
            <!-- Edit Mode: Textarea -->
            <textarea
              v-show="isEditingOld"
              ref="oldTextareaRef"
              v-model="oldText"
              class="duo-textarea"
              placeholder="Nhập hoặc dán văn bản cũ vào đây..."
              spellcheck="false"
              @blur="onTextareaBlur('old')"
            ></textarea>

            <!-- Diff View: Highlighted Stream -->
            <div
              v-show="!isEditingOld"
              ref="leftScrollRef"
              class="diff-stream-view"
              @click="onDiffClick('old')"
              @scroll="handleScroll('left')"
              :title="oldText ? 'Bấm vào để chỉnh sửa lại' : ''"
            >
              <div
                v-if="!oldText"
                class="empty-diff-placeholder"
                @click="startEditing('old')"
                title="Bấm để nhập văn bản"
              >
                <span class="placeholder-icon">📝</span>
                <p class="placeholder-main">Chưa có văn bản cũ</p>
                <p class="placeholder-sub">
                  Bấm vào đây để nhập hoặc dán văn bản.
                </p>
              </div>
              <div v-else class="diff-text-flow">
                <template v-for="chunk in diffResult.leftChunks" :key="chunk.id">
                  <!-- Highlighted Removed/Different Chunk -->
                  <span
                    v-if="chunk.isDiff"
                    class="diff-chunk diff-removed"
                    :title="`Đã thay đổi / bị xóa: '${chunk.value}'`"
                  >
                    <span class="diff-sign">-</span>
                    <template v-for="(part, pIdx) in parseChunkParts(chunk.value, true)" :key="pIdx">
                      <span v-if="part.type === 'text'" class="diff-val">{{ part.text }}</span>
                      <template v-else>
                        <span
                          class="eol-badge-diff"
                          :class="part.eolType.toLowerCase()"
                          :title="`Khác biệt EOL: '${part.eolType}'`"
                        >
                          <span class="eol-icon">↵</span>{{ part.eolType }}
                        </span>
                        <span v-if="part.raw && part.raw.includes('\n')">{{ '\n' }}</span>
                      </template>
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
                        <span v-if="part.raw && part.raw.includes('\n')">{{ '\n' }}</span>
                      </template>
                    </template>
                  </span>
                </template>
              </div>
            </div>
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
              <!-- Mode indicator / Toggle button -->
              <button
                class="icon-action-btn btn-mode-toggle"
                @click="toggleEdit('new')"
                :title="isEditingNew ? 'Xem kết quả so sánh' : 'Bấm để chỉnh sửa văn bản'"
              >
                {{ isEditingNew ? '🔍 Xem so sánh' : '✏️ Chỉnh sửa' }}
              </button>

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

              <label class="icon-action-btn" title="Tải file văn bản (.txt, .md, .js...)">
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
                :class="{ 'btn-success': copiedNew }"
                @click="copyText(newText, 'new')"
                title="Sao chép văn bản mới"
              >
                {{ copiedNew ? '✓ Đã chép' : '📋 Sao chép' }}
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="column-body">
            <!-- Edit Mode: Textarea -->
            <textarea
              v-show="isEditingNew"
              ref="newTextareaRef"
              v-model="newText"
              class="duo-textarea"
              placeholder="Nhập hoặc dán văn bản mới vào đây..."
              spellcheck="false"
              @blur="onTextareaBlur('new')"
            ></textarea>

            <!-- Diff View: Highlighted Stream -->
            <div
              v-show="!isEditingNew"
              ref="rightScrollRef"
              class="diff-stream-view"
              @click="onDiffClick('new')"
              @scroll="handleScroll('right')"
              :title="newText ? 'Bấm vào để chỉnh sửa lại' : ''"
            >
              <div
                v-if="!newText"
                class="empty-diff-placeholder"
                @click="startEditing('new')"
                title="Bấm để nhập văn bản"
              >
                <span class="placeholder-icon">📄</span>
                <p class="placeholder-main">Chưa có văn bản mới</p>
                <p class="placeholder-sub">
                  Bấm vào đây để nhập hoặc dán văn bản.
                </p>
              </div>
              <div v-else class="diff-text-flow">
                <template v-for="chunk in diffResult.rightChunks" :key="chunk.id">
                  <!-- Highlighted Added/Different Chunk -->
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
                      <template v-else>
                        <span
                          class="eol-badge-diff"
                          :class="part.eolType.toLowerCase()"
                          :title="`Khác biệt EOL: '${part.eolType}'`"
                        >
                          <span class="eol-icon">↵</span>{{ part.eolType }}
                        </span>
                        <span v-if="part.raw && part.raw.includes('\n')">{{ '\n' }}</span>
                      </template>
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
                        <span v-if="part.raw && part.raw.includes('\n')">{{ '\n' }}</span>
                      </template>
                    </template>
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.diff-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f7f7f7;
}

/* HEADER */
.app-header {
  background-color: #ffffff;
  border-bottom: 2px solid var(--duo-gray-border);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.header-container {
  max-width: 1400px;
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
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.5px;
  color: var(--duo-green);
}

.brand-diff {
  color: var(--duo-blue);
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
  padding: 5px 12px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 13px;
  border: 1.5px solid var(--duo-gray-border);
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
  font-size: 13px;
  font-weight: 900;
}
.text-red {
  color: var(--duo-red);
}
.text-green {
  color: var(--duo-green-dark);
}

/* MAIN CONTENT */
.main-content {
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 18px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

/* TOOLBAR */
.toolbar-card {
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  background-color: #ffffff;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-title {
  font-size: 11px;
  font-weight: 900;
  color: var(--duo-text-muted);
  letter-spacing: 0.5px;
}

.segmented-control {
  display: inline-flex;
  background-color: #f0f0f0;
  border-radius: 12px;
  padding: 3px;
  border: 1px solid var(--duo-gray-border);
}

.segment-btn {
  border: none;
  background: transparent;
  padding: 6px 13px;
  border-radius: 9px;
  font-family: var(--duo-font);
  font-size: 13px;
  font-weight: 800;
  color: var(--duo-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s ease;
}

.segment-btn.active {
  background-color: #ffffff;
  color: var(--duo-text-dark);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.segment-btn.red-mode.active {
  color: var(--duo-red);
}

.tool-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* SPLIT 2-COLUMN COMPARISON */
.diff-split-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  flex: 1;
}

.diff-column {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  overflow: hidden;
  height: calc(100vh - 200px);
  min-height: 520px;
}

.column-header {
  padding: 12px 16px;
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
  gap: 6px;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.4px;
  padding: 3px 10px;
  border-radius: 10px;
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
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: currentColor;
}

/* EOL Badges in header */
.eol-indicator {
  font-size: 10px;
  font-family: var(--duo-font-mono);
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 5px;
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
  font-size: 11.5px;
  font-weight: 700;
  color: var(--duo-text-muted);
}

.column-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.eol-convert-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-mini {
  padding: 3px 7px !important;
  font-size: 11px !important;
}

.icon-action-btn {
  background-color: #ffffff;
  border: 1.5px solid var(--duo-gray-border);
  border-bottom: 2px solid var(--duo-gray-border);
  border-radius: 9px;
  padding: 4px 10px;
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
  transform: translateY(1px);
}
.icon-action-btn.btn-success {
  background-color: var(--duo-green-light);
  color: var(--duo-green-dark);
  border-color: var(--duo-green);
}

.btn-mode-toggle {
  color: var(--duo-blue-dark);
  border-color: #a8e4ff;
  background-color: #f0faff;
}
.btn-mode-toggle:hover {
  background-color: #e0f4ff;
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

/* TEXTAREA WITH MONOSPACE */
.duo-textarea {
  width: 100%;
  height: 100%;
  padding: 18px;
  border: none;
  outline: none;
  resize: none;
  font-family: var(--duo-font-mono);
  font-size: 14px;
  tab-size: 2;
  line-height: 1.7;
  color: var(--duo-text);
  background-color: #ffffff;
}
.duo-textarea:focus {
  background-color: #fdfeff;
}

/* DIFF STREAM VIEW */
.diff-stream-view {
  width: 100%;
  height: 100%;
  padding: 18px;
  overflow-y: auto;
  overflow-x: auto;
  font-family: var(--duo-font-mono);
  font-size: 14px;
  tab-size: 2;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  cursor: pointer;
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
  cursor: pointer;
  border-radius: 12px;
  transition: background-color 0.15s ease;
}
.empty-diff-placeholder:hover {
  background-color: #fafafa;
}

.placeholder-icon {
  font-size: 38px;
  margin-bottom: 8px;
}

.placeholder-main {
  font-size: 15px;
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
  border-radius: 3px;
  transition: background-color 0.15s ease;
  font-family: var(--duo-font-mono);
}

.diff-same {
  color: #2b2b2b;
}

/* TÔ ĐỎ CHỖ KHÁC BIỆT */
.diff-removed {
  background-color: #ffd9da !important;
  color: #c91818 !important;
  border-bottom: 2px solid #e02424;
  border-radius: 4px;
  padding: 1px 4px;
  margin: 0 1px;
  font-weight: 700 !important;
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
  border-radius: 4px;
  padding: 1px 4px;
  margin: 0 1px;
  font-weight: 700 !important;
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
  font-size: 9px;
  font-weight: 900;
  padding: 1px 4px;
  margin: 0 2px;
  border-radius: 3px;
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
  border-radius: 3px;
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

/* Responsive adjustments */
@media (max-width: 900px) {
  .diff-split-container {
    grid-template-columns: 1fr;
  }
  .diff-column {
    height: 400px;
  }
}
</style>

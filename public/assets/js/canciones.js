// const SONG_DATA_URL = "/assets/letras/cuan_grande_es_dios.json"
// const SONG_DATA_URL = "/assets/letras/dios_incomparable.json"
// const SONG_DATA_URL = "/assets/letras/el_gran_yo_soy.json"
const SONGS_LIST_URL = "/assets/letras/lista_canciones.json"
let timelineScrollMode = "izquierda"
let currentSongDataUrl = "/assets/letras/dios_incomparable.json"

// ---- Reproducción de YouTube (puente con lite-youtube) ----
// Permite que el botón de play controle también el video de YouTube.
const ytLite = document.querySelector("lite-youtube")
let ytPlayer = null
let ytPlayerReady = false
let ytApiReady = false
// Asignado por renderSongTimeline para sincronizar el botón de play con el video.
let ytStateHandler = null
let currentRenderActive = null
let renderGeneration = 0

// Reemplaza un botón persistente por un clon limpio para eliminar listeners acumulados
// de renderizados anteriores (play/replay viven en el HTML estático y no se recrean).
function acquireFreshButton(id) {
    const old = document.getElementById(id)
    if (!old) return null
    const fresh = old.cloneNode(true)
    old.parentNode.replaceChild(fresh, old)
    return fresh
}

function isVideoPlaybackEnabled() {
    const videoToggle = document.querySelector('[data-toggle="video"]')
    return !videoToggle || videoToggle.dataset.active !== "false"
}

function tryBuildYtPlayer() {
    if (ytPlayer || !ytApiReady || !ytLite) return
    if (!window.YT || !window.YT.Player) return
    const iframe = ytLite.shadowRoot && ytLite.shadowRoot.querySelector("iframe")
    if (!iframe) return
    ytPlayer = new window.YT.Player(iframe, {
        events: {
            onReady: () => {
                ytPlayerReady = true
                if (typeof ytStateHandler === "function") ytStateHandler("sync")
            },
            onStateChange: (event) => {
                if (typeof ytStateHandler !== "function") return
                const YT = window.YT
                if (event.data === YT.PlayerState.PLAYING) ytStateHandler("playing")
                else if (event.data === YT.PlayerState.PAUSED) ytStateHandler("paused")
                else if (event.data === YT.PlayerState.ENDED) ytStateHandler("ended")
            }
        }
    })
}

function loadSongsList() {
    return fetch(SONGS_LIST_URL)
        .then((response) => response.json())
        .then((data) => {
            return data.canciones.map((cancion) => {
                return {
                    title: cancion.title,
                    url: cancion.url,
                    acordes: cancion.acordes,
                    tempo: cancion.tempo
                }
            })
        })
}

function resolveSongDataUrl(songUrl) {
    if (!songUrl) return currentSongDataUrl
    const normalized = String(songUrl).trim()
    if (/^https?:\/\//i.test(normalized)) return normalized
    if (normalized.startsWith("/")) return encodeURI(normalized)
    return encodeURI(`/assets/letras/${normalized}`)
}

function selectSong(songUrl) {
    const nextUrl = resolveSongDataUrl(songUrl)
    if (!nextUrl) return

    currentSongDataUrl = nextUrl
    document.querySelectorAll("#songs-list .song-item").forEach((item) => {
        const isSelected = resolveSongDataUrl(item.dataset.song) === currentSongDataUrl
        item.classList.toggle("selected", isSelected)
        item.classList.toggle("border-cyan-400/40", isSelected)
        item.classList.toggle("bg-cyan-500/10", isSelected)
        item.classList.toggle("text-slate-100", isSelected)
        item.classList.toggle("text-slate-400", !isSelected)
    })

    renderSongTimeline()
}

function renderSongsList() {
    const list = document.getElementById("songs-list")
    if (!list) return

    loadSongsList().then((songs) => {
        list.innerHTML = ""
        songs.forEach((song) => {
            const item = document.createElement("li")
            item.className = "song-item cursor-pointer rounded-xl border border-slate-800/70 bg-slate-900/70 p-3 text-sm text-slate-400 transition-all duration-200"
            item.dataset.song = song.url
            item.textContent = song.title
            item.tabIndex = 0
            item.setAttribute("role", "button")
            item.addEventListener("click", () => selectSong(song.url))
            item.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    selectSong(song.url)
                }
            })

            const isSelected = resolveSongDataUrl(song.url) === currentSongDataUrl
            if (isSelected) {
                item.classList.add("selected", "border-cyan-400/40", "bg-cyan-500/10", "text-slate-100")
                item.classList.remove("text-slate-400")
            }

            list.appendChild(item)
        })
    })
}

window.onYouTubeIframeAPIReady = window.onYouTubeIframeAPIReady || function () {
    ytApiReady = true
    tryBuildYtPlayer()
}

if (ytLite && !document.getElementById("youtube-iframe-api")) {
    const tag = document.createElement("script")
    tag.id = "youtube-iframe-api"
    tag.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(tag)
}

if (ytLite) {
    ytLite.addEventListener("liteYoutubeIframeLoaded", () => tryBuildYtPlayer())
}

function controlYoutube(shouldPlay) {
    if (!isVideoPlaybackEnabled()) {
        if (shouldPlay === false && ytPlayer && ytPlayerReady) {
            ytPlayer.pauseVideo()
        }
        return
    }
    if (!ytLite) return
    if (!ytPlayer || !ytPlayerReady) {
        // Primera reproducción: carga el iframe de lite-youtube (autoreproduce).
        if (shouldPlay) ytLite.click()
        return
    }
    if (shouldPlay) ytPlayer.playVideo()
    else ytPlayer.pauseVideo()
}

function toSolfege(chord) {
    if (!chord) return chord
    const map = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" }
    const match = String(chord).trim().match(/^([A-G])([#b]?)(.*)$/)
    if (!match) return chord
    const [, root, accidental, rest] = match
    return `${map[root] || root}${accidental}${rest}`
}

function updateSongInfo(song) {
    const title = document.getElementById("song-title")
    const artist = document.getElementById("song-artist")
    const key = document.getElementById("song-key")
    const tempo = document.getElementById("song-tempo")
    const timeSignature = document.getElementById("song-time signature")

    title.textContent = song.title
    artist.textContent = song.artist
    key.textContent = song.key
    tempo.textContent = song.bpm
    timeSignature.textContent = song.timeSignatureLabel
}

function bindTimelineModeButtons(root) {
    const modeButtons = root.querySelectorAll(".timeline-mode-btn")
    if (!modeButtons.length) {
        return
    }

    const syncModeButtons = () => {
        modeButtons.forEach((btn) => {
            const active = btn.dataset.mode === timelineScrollMode
            btn.classList.toggle("bg-cyan-500/15", active)
            btn.classList.toggle("text-cyan-200", active)
            btn.classList.toggle("text-slate-400", !active)
            btn.classList.toggle("hover:text-slate-200", !active)
        })
    }

    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            timelineScrollMode = btn.dataset.mode
            syncModeButtons()
        })
    })

    syncModeButtons()
}

async function loadSongTimelineTemplate(root) {
    try {
        const response = await fetch("/assets/templates/song-timeline-template.html")
        if (!response.ok) {
            throw new Error("No se pudo cargar la plantilla")
        }

        const html = await response.text()
        root.innerHTML = html
        bindTimelineModeButtons(root)
        return true
    } catch (error) {
        console.warn("No se pudo cargar la plantilla del timeline:", error)
        root.innerHTML = '<div class="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 text-sm text-slate-400">No se pudo cargar la plantilla.</div>'
        return false
    }
}

async function loadSongTimelineData() {
    try {
        const response = await fetch(currentSongDataUrl)
        if (response.ok) {
            return response.json()
        }
    } catch (error) {
        console.warn("No se pudo cargar la letra desde JSON:", error)
    }

    return null
}

function buildTimelineModel(songData) {
    const sectionDefs = Array.isArray(songData.sections) ? songData.sections : []
    const sectionByName = new Map()

    sectionDefs.forEach((section) => {
        if (section && section.name) {
            sectionByName.set(String(section.name).toLowerCase(), section)
        }
    })

    const structureList = Array.isArray(songData.structure) && songData.structure.length > 0
        ? songData.structure
        : sectionDefs.map((section) => section.name)

    const sectionInstances = structureList.map((name, index) => {
        const rawName = String(name)
        const def = sectionByName.get(rawName.toLowerCase())
        if (!def) {
            console.warn(`La entrada "${rawName}" en structure no coincide con ninguna sección definida (disponibles: ${sectionDefs.map((s) => s.name).join(", ")}).`)
            return { index, name: rawName, def: { name: rawName, items: [] }, missing: true, rawName }
        }
        return { index, name: def.name || rawName, def }
    })

    const cells = []
    const lyricCells = []
    let prevMeasure = null
    let itemIndex = 0

    sectionInstances.forEach((instance) => {
        const section = instance.def
        const items = Array.isArray(section.items) ? section.items : []
        prevMeasure = null

        items.forEach((item) => {
            const duration = Number(item.duration) || songData.metadata.timeSignature || 1
            const beats = Math.max(1, Math.floor(duration))
            const startsMeasure = item.measure !== prevMeasure && (!item.beat || item.beat === 1)
            const lyricOffset = Math.min(Math.max(0, Math.floor(Number(item.lyricOffset) || 0)), beats - 1)

            for (let beat = 0; beat < beats; beat += 1) {
                cells.push({
                    itemIndex,
                    sectionIndex: instance.index,
                    sectionName: instance.name,
                    chord: beat === 0 ? (item.chord || "") : "",
                    measureStart: beat === 0 && startsMeasure
                })

                const beatHasLyric = beat === lyricOffset
                lyricCells.push({
                    itemIndex,
                    beatHasLyric,
                    chord: beatHasLyric ? (item.chord || "") : "",
                    text: beatHasLyric ? (item.text || "") : ""
                })
            }

            prevMeasure = item.measure
            itemIndex += 1
        })
    })

    return { sectionDefs, sectionInstances, cells, lyricCells }
}

function createTimelineGrid({ cells, lyricCells }) {
    const card = document.createElement("div")
    card.className = "overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70 shadow-xl"

    const scroller = document.createElement("div")
    scroller.id = "chord-grid"
    scroller.className = "overflow-x-auto"

    const grid = document.createElement("div")
    grid.className = "flex chord-row"

    cells.forEach((cell, index) => {
        const cellEl = document.createElement("div")
        cellEl.dataset.step = index
        cellEl.dataset.item = cell.itemIndex
        cellEl.className = [
            "relative flex h-16 min-w-[68px] flex-1 items-center px-3",
            "border-r border-slate-800/80",
            cell.measureStart ? "border-l-2 border-l-slate-600" : "",
            "transition-colors duration-200"
        ].join(" ")

        const raw = (cell.chord || "").trim()
        const isRest = cell.measureStart && (raw === "" || raw === "-" || raw === "%")

        const label = document.createElement("span")
        if (isRest) {
            label.dataset.base = "text-slate-500"
            label.className = "mx-auto text-2xl text-slate-500"
            label.textContent = "𝄽"
        } else if (raw) {
            label.dataset.base = "text-cyan-200"
            label.className = "text-2xl font-semibold text-cyan-200"
            label.textContent = toSolfege(raw)
        }
        cellEl.appendChild(label)
        grid.appendChild(cellEl)
    })

    const lyricRow = document.createElement("div")
    lyricRow.className = "flex border-t border-slate-800/80 lyric-row"
    lyricCells.forEach((lc, index) => {
        const cellEl = document.createElement("div")
        cellEl.dataset.step = index
        cellEl.dataset.item = lc.itemIndex
        cellEl.className = [
            "relative min-h-[64px] min-w-[68px] flex-1 border-r border-slate-800/60 px-3 py-2",
            lc.beatHasLyric ? "border-l-2 border-l-slate-600/60" : "",
            "transition-colors duration-200"
        ].join(" ")

        if (lc.beatHasLyric) {
            const raw = lc.text || ""
            const match = raw.match(/^(.*?)%([^%]*)%([\s\S]*)$/)
            const lyricWrapper = document.createElement("p")
            lyricWrapper.className = "relative mt-0.5 whitespace-nowrap text-xl leading-5"
            if (match) {
                const [, before, syllable, after] = match
                const baseTextClass = "text-slate-100"
                if (before) {
                    const beforeSpan = document.createElement("span")
                    beforeSpan.className = `absolute right-full whitespace-nowrap ${baseTextClass} text-right`
                    beforeSpan.textContent = before.replace(/ $/, "\u00A0")
                    lyricWrapper.appendChild(beforeSpan)
                }
                if (syllable) {
                    const syllSpan = document.createElement("span")
                    syllSpan.className = `font-semibold underline ${baseTextClass}`
                    syllSpan.textContent = syllable
                    lyricWrapper.appendChild(syllSpan)
                }
                if (after) {
                    const afterSpan = document.createElement("span")
                    afterSpan.className = baseTextClass
                    afterSpan.textContent = after.replace(/^ /, "\u00A0")
                    lyricWrapper.appendChild(afterSpan)
                }
            } else {
                lyricWrapper.classList.add("text-slate-100")
                lyricWrapper.textContent = raw
            }
            cellEl.appendChild(lyricWrapper)
        }
        lyricRow.appendChild(cellEl)
    })

    scroller.appendChild(grid)
    scroller.appendChild(lyricRow)
    card.appendChild(scroller)

    return { card, scroller, grid, lyricRow }
}

function renderSectionCards({ sectionInstances, sectionDefs, sectionsContainer }) {
    const sectionCards = []
    if (!sectionsContainer) {
        return sectionCards
    }

    sectionsContainer.innerHTML = ""
    sectionInstances.forEach((instance) => {
        const card = document.createElement("button")
        card.type = "button"
        card.dataset.section = String(instance.index)
        if (instance.missing) {
            card.className = "min-w-[100px] cursor-not-allowed rounded-2xl border-2 border-dashed border-amber-400/70 bg-amber-500/10 p-3 text-amber-200 transition-all duration-300"
            card.title = `La entrada "${instance.rawName}" en structure no coincide con ninguna sección definida. Revisa que el nombre coincida con alguno de: ${sectionDefs.map((s) => s.name).join(", ")}.`
            card.textContent = `⚠ ${instance.name}`
        } else {
            card.className = "min-w-[100px] cursor-pointer rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3 transition-all duration-300 hover:border-cyan-400/40 hover:text-slate-100"
            card.textContent = instance.name || `Sección ${instance.index + 1}`
        }
        sectionsContainer.appendChild(card)
        sectionCards.push(card)
    })

    return sectionCards
}

function renderActiveTimeline({ gridCells, lyricCellsEls, sectionCards, cells, scroller, activeIndex }) {
    if (!gridCells.length) return

    gridCells.forEach((cellEl, index) => {
        const isActive = index === activeIndex
        cellEl.classList.toggle("bg-cyan-500/20", isActive)
        cellEl.classList.toggle("shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]", isActive)
        const label = cellEl.querySelector("span")
        if (label) {
            if (isActive) {
                label.classList.remove("text-cyan-200", "text-slate-500")
                label.classList.add("text-white")
            } else {
                label.classList.remove("text-white")
                label.classList.add(label.dataset.base || "text-cyan-200")
            }
        }
    })

    lyricCellsEls.forEach((lyricCell) => {
        const isActive = lyricCell.dataset.step === String(activeIndex)
        lyricCell.classList.toggle("bg-cyan-500/10", isActive)
    })

    const currentSectionIndex = cells[activeIndex]?.sectionIndex
    sectionCards.forEach((card) => {
        const isActive = card.dataset.section === String(currentSectionIndex)
        card.classList.toggle("border-cyan-400/60", isActive)
        card.classList.toggle("bg-cyan-500/20", isActive)
        card.classList.toggle("text-cyan-100", isActive)
        card.classList.toggle("shadow-[0_0_24px_-6px_rgba(34,211,238,0.7)]", isActive)
    })

    const activeCell = gridCells[activeIndex]
    if (activeCell) {
        const maxScroll = scroller.scrollWidth - scroller.clientWidth
        const scrollerRect = scroller.getBoundingClientRect()
        const cellRect = activeCell.getBoundingClientRect()
        const cellLeftInContent = cellRect.left - scrollerRect.left + scroller.scrollLeft
        const cellWidth = cellRect.width

        if (timelineScrollMode === "izquierda") {
            const cellsToLeft = 3
            const target = cellLeftInContent - cellsToLeft * cellWidth
            scroller.scrollTo({
                left: Math.max(0, Math.min(target, maxScroll)),
                behavior: "smooth"
            })
        } else {
            const isVisible = cellRect.left >= scrollerRect.left && cellRect.right <= scrollerRect.right
            if (!isVisible) {
                const target = cellLeftInContent + cellWidth / 2 - scroller.clientWidth / 4
                scroller.scrollTo({
                    left: Math.max(0, Math.min(target, maxScroll)),
                    behavior: "smooth"
                })
            }
        }
    }
}

async function renderSongTimeline() {
    const root = document.getElementById("song-timeline-root")
    if (!root) {
        return
    }

    const myGeneration = ++renderGeneration
    const isStale = () => myGeneration !== renderGeneration

    const templateLoaded = await loadSongTimelineTemplate(root)
    if (!templateLoaded || isStale()) {
        return
    }

    const windowLetra = document.getElementById("timeline-container")
    if (!windowLetra) {
        return
    }

    windowLetra.innerHTML = ""

    const track = document.createElement("div")
    track.className = "rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4"

    const songData = await loadSongTimelineData()
    if (!songData || isStale()) {
        return
    }

    const bpm = songData.metadata?.bpm || 120
    const bpmTime = 60000 / bpm
    console.log("bpmTime", bpmTime)
    const animationDelayMs = (Number(songData.metadata?.animationDelay) || 0) * 1000
    updateSongInfo(songData.metadata)

    const newVideoId = songData.metadata?.["videoid-youtube"]
    if (ytLite && newVideoId && ytLite.getAttribute("videoid") !== newVideoId) {
        ytPlayer = null
        ytPlayerReady = false
        ytLite.setAttribute("videoid", newVideoId)
    }

    if (Array.isArray(songData.sections) && songData.sections.length > 0) {
        track.className = "space-y-4"

        const { sectionDefs, sectionInstances, cells, lyricCells } = buildTimelineModel(songData)
        const { card, scroller, grid, lyricRow } = createTimelineGrid({ cells, lyricCells })

        track.appendChild(card)
        windowLetra.appendChild(track)

        const sectionsContainer = document.getElementById("timeline-sections")
        const sectionCards = renderSectionCards({ sectionInstances, sectionDefs, sectionsContainer })

        const gridCells = Array.from(grid.querySelectorAll("[data-step]"))
        const lyricCellsEls = Array.from(lyricRow.querySelectorAll("[data-step]"))
        let activeIndex = 0

        const renderActive = () => {
            renderActiveTimeline({
                gridCells,
                lyricCellsEls,
                sectionCards,
                cells,
                scroller,
                activeIndex
            })
        }

        currentRenderActive = renderActive

        const finishPlayback = () => {
            if (isStale()) return
            stopTimeline()
            clearPendingFallback()
            isPlaying = false
            pendingPlay = false
            playbackOffsetSec = 0
            if (playIcon) playIcon.classList.toggle("hidden", false)
            if (pauseIcon) pauseIcon.classList.toggle("hidden", true)
            if (playButton) playButton.setAttribute("aria-label", "Reproducir")
            if (statusLabel) statusLabel.textContent = "Finalizado"
            if (statusDot) {
                statusDot.classList.toggle("bg-cyan-300", false)
                statusDot.classList.toggle("bg-slate-400", true)
            }
            if (statusBadge) {
                statusBadge.classList.toggle("border-cyan-400/20", false)
                statusBadge.classList.toggle("bg-cyan-500/10", false)
                statusBadge.classList.toggle("text-cyan-300", false)
                statusBadge.classList.toggle("border-slate-400/20", true)
                statusBadge.classList.toggle("bg-slate-500/10", true)
                statusBadge.classList.toggle("text-slate-300", true)
            }
            if (ytPlayer && ytPlayerReady) {
                ytPlayer.pauseVideo()
                ytPlayer.seekTo(0, true)
            }
            activeIndex = 0
            renderActive()
            if (scroller) scroller.scrollTo({ left: 0, behavior: "smooth" })
        }

        cancelAnimationFrame(window.timelineRAF)
        renderActive()

        const playButton = acquireFreshButton("timeline-play")
        const playIcon = playButton?.querySelector("[data-play-icon]")
        const pauseIcon = playButton?.querySelector("[data-pause-icon]")
        if (playIcon) playIcon.classList.remove("hidden")
        if (pauseIcon) pauseIcon.classList.add("hidden")
        if (playButton) playButton.setAttribute("aria-label", "Reproducir")
        const statusBadge = document.getElementById("timeline-status")
        const statusDot = statusBadge?.querySelector("[data-status-dot]")
        const statusLabel = statusBadge?.querySelector("[data-status-label]")
        let isPlaying = false
        let pendingPlay = false
        let pendingPlaySkipDelay = false
        let pendingPlayFallback = null
        let countingDown = false
        let countdownToken = 0
        let pendingSeek = null
        let playbackOffsetSec = 0

        const countdownOverlay = document.getElementById("countdown-overlay")
        const countdownNumber = countdownOverlay?.querySelector(".countdown-number")

        const stopCountdown = () => {
            countingDown = false
            countdownToken += 1
            if (countdownOverlay) {
                countdownOverlay.classList.add("hidden")
                countdownOverlay.classList.remove("flex")
                countdownOverlay.dataset.active = "false"
            }
            if (countdownNumber) countdownNumber.textContent = ""
        }

        const showCountNumber = (value) => {
            if (!countdownOverlay || !countdownNumber) return
            countdownNumber.textContent = value
            countdownOverlay.dataset.active = "false"
            void countdownNumber.offsetWidth
            countdownOverlay.dataset.active = "true"
        }

        const runCountdown = () => {
            const token = ++countdownToken
            countingDown = true
            if (countdownOverlay) {
                countdownOverlay.classList.remove("hidden")
                countdownOverlay.classList.add("flex")
            }
            return new Promise((resolve) => {
                let n = 3
                showCountNumber(n)
                const tick = () => {
                    if (token !== countdownToken || !countingDown) {
                        stopCountdown()
                        resolve(false)
                        return
                    }
                    n -= 1
                    if (n <= 0) {
                        stopCountdown()
                        resolve(true)
                    } else {
                        showCountNumber(n)
                        setTimeout(tick, bpmTime)
                    }
                }
                setTimeout(tick, bpmTime)
            })
        }

        let fallbackClockStart = null
        const startTimeline = () => {
            if (isStale()) return
            cancelAnimationFrame(window.timelineRAF)
            fallbackClockStart = performance.now() - (playbackOffsetSec * 1000)
            const tick = () => {
                if (!isPlaying || isStale()) return
                let t = null
                // Solo se usa el tiempo del video cuando la reproducción de video está activa;
                // si está desactivado (o nunca se cargó), la animación avanza con el reloj interno.
                if (isVideoPlaybackEnabled() && ytPlayer && ytPlayerReady) {
                    const ct = ytPlayer.getCurrentTime()
                    if (typeof ct === "number" && isFinite(ct)) t = ct
                }
                if (t == null) {
                    if (fallbackClockStart == null) fallbackClockStart = performance.now()
                    t = (performance.now() - fallbackClockStart) / 1000
                }
                // animationDelay indica dónde inicia el video (seek), no un retardo de la animación.
                // La animación arranca en beat 0 justo tras el conteo; por eso se resta el offset
                // del video a la posición real de reproducción.
                const elapsed = (t - animationDelayMs / 1000) * bpm / 60
                const next = Math.floor(elapsed)
                if (next >= gridCells.length) {
                    finishPlayback()
                    return
                }
                const clamped = Math.max(0, next)
                if (clamped !== activeIndex) {
                    activeIndex = clamped
                    renderActive()
                }
                window.timelineRAF = requestAnimationFrame(tick)
            }
            window.timelineRAF = requestAnimationFrame(tick)
        }

        const startTimelineAfterDelay = () => startTimeline()
        const stopTimeline = () => {
            if (isStale()) return
            cancelAnimationFrame(window.timelineRAF)
            window.timelineRAF = null
        }
        const clearPendingFallback = () => {
            if (pendingPlayFallback) {
                clearTimeout(pendingPlayFallback)
                pendingPlayFallback = null
            }
        }

        const setPlaying = (playing, { fromYoutube = false, skipDelay = false } = {}) => {
            if (isStale()) return
            if (fromYoutube && isPlaying === playing) {
                if (playing && pendingPlay) {
                    pendingPlay = false
                    clearPendingFallback()
                    startTimelineAfterDelay({ skipDelay: pendingPlaySkipDelay })
                }
                return
            }
            isPlaying = playing
            if (playIcon) playIcon.classList.toggle("hidden", playing)
            if (pauseIcon) pauseIcon.classList.toggle("hidden", !playing)
            if (playButton) playButton.setAttribute("aria-label", playing ? "Pausar" : "Reproducir")
            if (statusLabel) statusLabel.textContent = playing ? "En reproducción" : "En pausa"
            if (statusDot) {
                statusDot.classList.toggle("bg-cyan-300", playing)
                statusDot.classList.toggle("bg-slate-400", !playing)
            }
            if (statusBadge) {
                statusBadge.classList.toggle("border-cyan-400/20", playing)
                statusBadge.classList.toggle("bg-cyan-500/10", playing)
                statusBadge.classList.toggle("text-cyan-300", playing)
                statusBadge.classList.toggle("border-slate-400/20", !playing)
                statusBadge.classList.toggle("bg-slate-500/10", !playing)
                statusBadge.classList.toggle("text-slate-300", !playing)
            }
            if (playing) {
                if (!fromYoutube && !isVideoPlaybackEnabled()) {
                    pendingPlay = false
                    clearPendingFallback()
                    startTimelineAfterDelay({ skipDelay })
                } else if (!fromYoutube && !ytPlayerReady) {
                    pendingPlay = true
                    pendingPlaySkipDelay = skipDelay
                    stopTimeline()
                    clearPendingFallback()
                    pendingPlayFallback = setTimeout(() => {
                        if (pendingPlay && !isStale()) {
                            pendingPlay = false
                            startTimelineAfterDelay({ skipDelay: pendingPlaySkipDelay })
                        }
                    }, 4000)
                } else {
                    pendingPlay = false
                    clearPendingFallback()
                    startTimelineAfterDelay({ skipDelay })
                }
            } else {
                pendingPlay = false
                pendingSeek = null
                clearPendingFallback()
                stopTimeline()
            }
            if (!fromYoutube) controlYoutube(playing)
        }

        ytStateHandler = (state) => {
            if (isStale()) return
            if (countingDown) {
                if (state === "playing" && isVideoPlaybackEnabled() && ytPlayer && ytPlayerReady) {
                    ytPlayer.pauseVideo()
                } else if (state === "sync" && isVideoPlaybackEnabled() && ytPlayer && ytPlayerReady && pendingSeek != null) {
                    ytPlayer.seekTo(pendingSeek, true)
                    pendingSeek = null
                }
                return
            }
            if (state === "playing") {
                setPlaying(true, { fromYoutube: true })
            } else if (state === "paused") {
                setPlaying(false, { fromYoutube: true })
            } else if (state === "ended") {
                finishPlayback()
            } else if (state === "sync" && ytPlayer && ytPlayerReady) {
                if (pendingSeek != null) {
                    ytPlayer.seekTo(pendingSeek, true)
                    pendingSeek = null
                }
                if (isPlaying) ytPlayer.playVideo()
                else ytPlayer.pauseVideo()
            }
        }

        const startWithCountdown = async () => {
            if (countingDown) {
                stopCountdown()
                return
            }
            if (isPlaying) {
                setPlaying(false)
                return
            }
            playbackOffsetSec = animationDelayMs / 1000
            if (isVideoPlaybackEnabled() && ytPlayer && ytPlayerReady) {
                ytPlayer.pauseVideo()
                ytPlayer.seekTo(playbackOffsetSec, true)
                pendingSeek = null
            } else if (isVideoPlaybackEnabled()) {
                pendingSeek = playbackOffsetSec
                controlYoutube(true)
            } else {
                pendingSeek = null
            }
            const go = await runCountdown()
            if (!go || isStale()) return
            setPlaying(true)
        }

        playButton?.addEventListener("click", startWithCountdown)

        const replayButton = acquireFreshButton("timeline-replay")
        const replaySong = async () => {
            stopCountdown()
            stopTimeline()
            countingDown = true
            countdownToken += 1
            playbackOffsetSec = animationDelayMs / 1000
            if (ytPlayer && ytPlayerReady) {
                ytPlayer.pauseVideo()
                ytPlayer.seekTo(playbackOffsetSec, true)
                pendingSeek = null
            } else if (isVideoPlaybackEnabled()) {
                pendingSeek = playbackOffsetSec
            } else {
                pendingSeek = null
            }
            activeIndex = 0
            renderActive()
            const go = await runCountdown()
            if (!go || isStale()) return
            setPlaying(true)
        }
        replayButton?.addEventListener("click", replaySong)

        const jumpToSection = async (instance) => {
            if (instance.missing) return
            const targetCell = cells.findIndex((c) => c.sectionIndex === instance.index)
            if (targetCell < 0) return
            stopCountdown()
            stopTimeline()
            countingDown = true
            countdownToken += 1
            activeIndex = targetCell
            renderActive()
            const seekSec = animationDelayMs / 1000 + (targetCell * bpmTime / 1000)
            playbackOffsetSec = seekSec
            if (isVideoPlaybackEnabled() && ytPlayer && ytPlayerReady) {
                ytPlayer.pauseVideo()
                ytPlayer.seekTo(seekSec, true)
                pendingSeek = null
            } else {
                pendingSeek = seekSec
                if (isVideoPlaybackEnabled()) {
                    controlYoutube(true)
                }
            }
            const go = await runCountdown()
            if (!go || isStale()) return
            setPlaying(true, { skipDelay: true })
        }
        sectionCards.forEach((card) => {
            const instance = sectionInstances.find((i) => String(i.index) === card.dataset.section)
            if (!instance) return
            card.addEventListener("click", () => jumpToSection(instance))
        })

        return
    }
}
renderSongsList()
renderSongTimeline()

window.addEventListener("timeline:maximize", () => {
    if (typeof currentRenderActive === "function") currentRenderActive()
})

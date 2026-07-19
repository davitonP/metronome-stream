const SONG_DATA_URL = "/assets/letras/cuan_grande_es_dios.json"
let timelineScrollMode = "izquierda"

// ---- Reproducción de YouTube (puente con lite-youtube) ----
// Permite que el botón de play controle también el video de YouTube.
const ytLite = document.querySelector("lite-youtube")
let ytPlayer = null
let ytPlayerReady = false
let ytApiReady = false
// Asignado por renderSongTimeline para sincronizar el botón de play con el video.
let ytStateHandler = null

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
    tempo.textContent = song.tempo
    timeSignature.textContent = song.timeSignature
}

async function renderSongTimeline() {
    const root = document.getElementById("song-timeline-root")
    if (!root) {
        return
    }

    try {
        const response = await fetch("/assets/templates/song-timeline-template.html")
        if (!response.ok) {
            throw new Error("No se pudo cargar la plantilla")
        }

        const html = await response.text()
        root.innerHTML = html

        // Botones "Izquierda" / "Seguir" — viven en la plantilla
        const modeButtons = root.querySelectorAll(".timeline-mode-btn")
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
    } catch (error) {
        console.warn("No se pudo cargar la plantilla del timeline:", error)
        root.innerHTML = '<div class="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 text-sm text-slate-400">No se pudo cargar la plantilla.</div>'
        return
    }

    const windowLetra = document.getElementById("timeline-container")
    if (!windowLetra) {
        return
    }

    windowLetra.innerHTML = ""

    const track = document.createElement("div")
    track.className = "rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4"

    let songData = null

    try {
        const response = await fetch(SONG_DATA_URL)
        if (response.ok) {
            songData = await response.json()
        }
    } catch (error) {
        console.warn("No se pudo cargar la letra desde JSON:", error)
    }

    if (!songData) {
        return
    }

    const bpm = songData.metadata?.bpm || 120
    const bpmTime = 60000 / bpm
    // Retardo (en ms) entre el inicio del video y el de la animación:
    // compensa que la canción en el video no suele empezar en el segundo 0.00.
    const animationDelayMs = (Number(songData.metadata?.animationDelay) || 0) * 1000
    updateSongInfo(songData.metadata)
    // console.log("BPM:", bpm)

    if (Array.isArray(songData.sections) && songData.sections.length > 0) {
        track.className = "space-y-4"

        // Flatten sections -> one grid cell per beat + one lyric entry per item
        const cells = []
        const lyrics = []
        let prevMeasure = null
        let itemIndex = 0

        songData.sections.forEach((section, sectionIndex) => {
            const items = Array.isArray(section.items) ? section.items : []
            items.forEach((item) => {
                const beats = Math.max(1, Math.floor(Number(item.duration) || 1))
                const startsMeasure = item.measure !== prevMeasure && (!item.beat || item.beat === 1)

                lyrics.push({
                    itemIndex,
                    sectionName: section.name || "",
                    chord: item.chord || "",
                    text: item.text || ""
                })

                for (let beat = 0; beat < beats; beat += 1) {
                    cells.push({
                        itemIndex,
                        sectionIndex,
                        sectionName: section.name || "",
                        chord: beat === 0 ? (item.chord || "") : "",
                        measureStart: beat === 0 && startsMeasure
                    })
                }

                prevMeasure = item.measure
                itemIndex += 1
            })
        })

        // ---- Dark chord-grid card ----
        const card = document.createElement("div")
        card.className = "overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70 shadow-xl"

        const grid = document.createElement("div")
        grid.id = "chord-grid"
        grid.className = "flex overflow-x-auto"

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

        const letraTab = document.createElement("div")
        letraTab.className = "flex justify-center border-t border-slate-800/80 py-2"


        card.appendChild(grid)
        card.appendChild(letraTab)

        // Lyrics panel, revealed by the "Letra" tab
        const lyricTrack = document.createElement("div")
        lyricTrack.className = "rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4"
        const lyricItems = document.createElement("div")
        lyricItems.className = "flex gap-3 overflow-x-auto pb-2"
        lyrics.forEach((ly) => {
            const lyricCard = document.createElement("div")
            lyricCard.dataset.item = ly.itemIndex
            lyricCard.className = "min-w-[220px] rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3 transition-all duration-300"
            const chordTag = document.createElement("p")
            chordTag.className = "text-xs font-semibold uppercase tracking-wide text-cyan-300"
            chordTag.textContent = ly.chord ? toSolfege(ly.chord) : ""
            const lyricText = document.createElement("p")
            lyricText.className = "mt-1 text-sm leading-6 text-slate-100"
            lyricText.textContent = ly.text || "—"
            lyricCard.appendChild(chordTag)
            lyricCard.appendChild(lyricText)
            lyricItems.appendChild(lyricCard)
        })
        lyricTrack.appendChild(lyricItems)

        track.appendChild(card)
        track.appendChild(lyricTrack)
        windowLetra.appendChild(track)

        // Section cards (current section indicator)
        const sectionsContainer = document.getElementById("timeline-sections")
        const sectionCards = []
        if (sectionsContainer) {
            sectionsContainer.innerHTML = ""
            songData.sections.forEach((section, index) => {
                const card = document.createElement("button")
                card.type = "button"
                card.dataset.section = String(index)
                card.className = "min-w-[100px] rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3 transition-all duration-300 "
                // card.className = "inline-flex h-12 min-w-[3rem] shrink-0 items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/70 px-4 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-slate-100"
                card.textContent = section.name || `Sección ${index + 1}`
                sectionsContainer.appendChild(card)
                sectionCards.push(card)
            })
        }

        // Highlight the currently playing beat cell (and its lyric line)
        const gridCells = Array.from(grid.querySelectorAll("[data-step]"))
        const lyricCards = Array.from(lyricItems.querySelectorAll("[data-item]"))
        let activeIndex = 0

        const renderActive = () => {
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

            const activeItem = gridCells[activeIndex]?.dataset.item
            lyricCards.forEach((lyricCard) => {
                const isActive = lyricCard.dataset.item === activeItem
                lyricCard.classList.toggle("border-cyan-400/60", isActive)
                lyricCard.classList.toggle("bg-cyan-500/10", isActive)
                lyricCard.classList.toggle("scale-[1.02]", isActive)
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
                const maxScroll = grid.scrollWidth - grid.clientWidth
                const gridRect = grid.getBoundingClientRect()
                const cellRect = activeCell.getBoundingClientRect()
                const cellLeftInContent = cellRect.left - gridRect.left + grid.scrollLeft
                const cellWidth = cellRect.width

                if (timelineScrollMode === "izquierda") {
                    const cellsToLeft = 3
                    const target =
                        cellLeftInContent - cellsToLeft * cellWidth
                    grid.scrollTo({
                        left: Math.max(0, Math.min(target, maxScroll)),
                        behavior: "smooth"
                    })
                } else {
                    const isVisible =
                        cellRect.left >= gridRect.left && cellRect.right <= gridRect.right
                    if (!isVisible) {
                        const target =
                            cellLeftInContent + cellWidth / 2 -
                            grid.clientWidth / 4
                        grid.scrollTo({
                            left: Math.max(0, Math.min(target, maxScroll)),
                            behavior: "smooth"
                        })
                    }
                }
            }
        }

        const advance = () => {
            activeIndex = (activeIndex + 1) % gridCells.length
            renderActive()
        }

        window.clearInterval(window.timelineInterval)
        renderActive()

        // Play / pause control
        const playButton = document.getElementById("timeline-play")
        const playIcon = playButton?.querySelector("[data-play-icon]")
        const pauseIcon = playButton?.querySelector("[data-pause-icon]")
        const statusBadge = document.getElementById("timeline-status")
        const statusDot = statusBadge?.querySelector("[data-status-dot]")
        const statusLabel = statusBadge?.querySelector("[data-status-label]")
        let isPlaying = false
        let pendingPlay = false
        let pendingPlayFallback = null
        let countingDown = false
        let countdownToken = 0

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
            // Reinicia la animación de pop
            void countdownNumber.offsetWidth
            countdownOverlay.dataset.active = "true"
        }

        // Cuenta regresiva al ritmo del BPM. Devuelve una promesa que se
        // resuelve al terminar (o se rechaza si se cancela con stopCountdown).
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

        let timelineDelayTimeout = null
        const startTimeline = () => {
            window.clearInterval(window.timelineInterval)
            window.timelineInterval = window.setInterval(advance, bpmTime)
        }
        const clearTimelineDelay = () => {
            if (timelineDelayTimeout) {
                clearTimeout(timelineDelayTimeout)
                timelineDelayTimeout = null
            }
        }
        // Arranca el timeline tras el animationDelay del JSON, para que la
        // animación comience cuando realmente inicia la canción en el video.
        const startTimelineAfterDelay = () => {
            clearTimelineDelay()
            if (animationDelayMs > 0) {
                timelineDelayTimeout = setTimeout(() => {
                    timelineDelayTimeout = null
                    startTimeline()
                }, animationDelayMs)
            } else {
                startTimeline()
            }
        }
        const stopTimeline = () => {
            window.clearInterval(window.timelineInterval)
            clearTimelineDelay()
        }
        const clearPendingFallback = () => {
            if (pendingPlayFallback) {
                clearTimeout(pendingPlayFallback)
                pendingPlayFallback = null
            }
        }

        const setPlaying = (playing, { fromYoutube = false } = {}) => {
            // El video confirma reproducción: si estábamos esperando su carga,
            // arrancamos el timeline ahora para no ir por delante del video.
            if (fromYoutube && isPlaying === playing) {
                if (playing && pendingPlay) {
                    pendingPlay = false
                    clearPendingFallback()
                    startTimelineAfterDelay()
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
                // Primera reproducción: el iframe aún no está listo. Esperamos a
                // que el video confirme (PLAYING) para arrancar la animación y
                // evitar que vaya por delante. Respaldo por si falla la carga.
                if (!fromYoutube && !ytPlayerReady) {
                    pendingPlay = true
                    stopTimeline()
                    clearPendingFallback()
                    pendingPlayFallback = setTimeout(() => {
                        if (pendingPlay) {
                            pendingPlay = false
                            startTimelineAfterDelay()
                        }
                    }, 4000)
                } else {
                    pendingPlay = false
                    clearPendingFallback()
                    startTimelineAfterDelay()
                }
            } else {
                pendingPlay = false
                clearPendingFallback()
                stopTimeline()
            }
            if (!fromYoutube) controlYoutube(playing)
        }

        // Sincroniza el botón de play con los cambios de estado del video de YouTube.
        ytStateHandler = (state) => {
            // Durante el conteo regresivo, el video se precarga pero no debe
            // sonar: si empieza a reproducir, lo pausamos e ignoramos el estado
            // hasta que el conteo termine.
            if (countingDown) {
                if (state === "playing" && ytPlayer && ytPlayerReady) {
                    ytPlayer.pauseVideo()
                }
                return
            }
            if (state === "playing") {
                setPlaying(true, { fromYoutube: true })
            } else if (state === "paused" || state === "ended") {
                setPlaying(false, { fromYoutube: true })
            } else if (state === "sync" && ytPlayer && ytPlayerReady) {
                if (isPlaying) ytPlayer.playVideo()
                else ytPlayer.pauseVideo()
            }
        }

        // Inicia la reproducción con conteo regresivo (3, 2, 1).
        // Precarga el video durante el conteo para que arranque a la par.
        const startWithCountdown = async () => {
            if (countingDown) {
                stopCountdown()
                return
            }
            // Si ya está sonando, el click pausa sin conteo.
            if (isPlaying) {
                setPlaying(false)
                return
            }
            // Durante el conteo, precargamos el iframe si aún no existe.
            if (!ytPlayerReady) controlYoutube(true)
            const go = await runCountdown()
            if (!go) return
            setPlaying(true)
        }

        playButton?.addEventListener("click", startWithCountdown)

        // Botón "volver al inicio": reinicia el timeline y el video desde cero.
        const replayButton = document.getElementById("timeline-replay")
        const replaySong = async () => {
            stopCountdown()
            // Si está sonando, detenemos timeline y video para que el conteo
            // respete silencio y la animación no avance durante el 3-2-1.
            stopTimeline()
            countingDown = true
            countdownToken += 1
            if (ytPlayer && ytPlayerReady) {
                ytPlayer.pauseVideo()
                ytPlayer.seekTo(0, true)
            }
            activeIndex = 0
            renderActive()
            const go = await runCountdown()
            if (!go) return
            setPlaying(true)
        }
        replayButton?.addEventListener("click", replaySong)

        return
    }

}

renderSongTimeline()

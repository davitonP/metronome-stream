const canciones = [
    {
        name: "Cuan grande es Dios",
        url: "/assets/secuencias/prueba.mp4",
        letra: {
            verso1: "El esplendor de un rey\n Vestido en majestad\n La tierra alegre está\n La tierra alegre está\n\n Cubierto está de luz\n Venció la oscuridad\n Y tiembla a su voz\n Y tiembla a su voz",
            coro: "Cuán grande es Dios Cántale cuán grande es Dios\n Y todos lo verán, cuán grande es Dios",
            verso2: "Día a día él está\n el tiempo está en él\n Principio y el fin]\n Principio y el fin.\n\n La trinidad en Dios\n El padre, hijo, espíritu\n Cordero y el león\n Cordero y el león",
            puente: "Tu Nombre sobre todo es\n Eres digno de alabar\n Y mi ser dirá\n Cuan grande es Dios"
        }
    },
]



function showLetra(nameSong) {
    const cancion = canciones.find(cancion => cancion.name === nameSong)
    if (!cancion) {
        return
    }
    
    const letras = cancion.letra
    let windowLetra = document.getElementById("letras-list")
    windowLetra.innerHTML = ""  // Limpiar contenido previo

    for (const [key, value] of Object.entries(letras)) {
        const sectionDiv = document.createElement("div")
        sectionDiv.classList.add("mb-4")

        const sectionTitle = document.createElement("h3")
        sectionTitle.classList.add("text-lg", "font-semibold", "mb-2", "text-blue-600")
        sectionTitle.textContent = key.charAt(0).toUpperCase() + key.slice(1)  // Capitalizar la primera letra

        const sectionContent = document.createElement("p")
        sectionContent.classList.add("text-gray-800", "whitespace-pre-line")
        sectionContent.textContent = value

        sectionDiv.appendChild(sectionTitle)
        sectionDiv.appendChild(sectionContent)

        windowLetra.appendChild(sectionDiv)
    }
    
}

showLetra("Cuan grande es Dios")

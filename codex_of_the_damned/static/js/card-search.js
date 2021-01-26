class CardSearch {
    constructor() {
        this.form = document.getElementById("card-search-form")
        this.result_message = document.getElementById("result-message")
        this.results = document.getElementById("results")
        this.card_image = document.getElementById("card-image")
        this.image_footer = document.getElementById("image-footer")
        this.card_sets = document.getElementById("card-sets")
        this.card_title = document.getElementById("card-title")
        this.card_text = document.getElementById("card-text")
        this.rulings = document.getElementById("rulings")
        this.ruling_form = document.getElementById("ruling-form")
        this.completion = new Completion(document.getElementById("card-name"), completeCardName, this.result_message)
        this.state = new UrlState(async (data) => this.displayCard(data.card))
        this.form.addEventListener("submit", async (ev) => await this.submit(ev))
        this.ruling_form.addEventListener("submit", async (ev) => await this.submitRuling(ev))
    }
    async submit(ev) {
        ev.preventDefault()
        const card = ev.target.elements["card-name"].value
        this.state.update({ card: card })
        await this.displayCard(card)
    }
    clear() {
        this.results.style.display = "none"
        this.card_image.src = ""
        this.image_footer.innerHTML = ""
        this.card_sets.innerHTML = ""
        this.card_title.textContent = ""
        this.card_text.innerHTML = ""
        this.result_message.innerHTML = ""
        // remove rulings, keep title
        for (const elem of this.rulings.children) {
            if (elem != this.rulings.firstElementChild) {
                this.rulings.removeChild(elem)
            }
        }
    }
    async displayCard(name) {
        this.clear()
        if (!name) {
            return
        }
        let data
        try {
            data = await this.fetchCard(name)
        } catch (error) {
            this.result_message.innerHTML = `<p>${error.message}</p>`
        }
        if (!data) {
            return
        }
        const lang = document.documentElement.lang
        let title = data.name
        let text = data.card_text
        let translation
        this.card_image.src = data.url
        if (data._i18n && lang in data._i18n) {
            if ("name" in data._i18n[lang]) {
                title = data._i18n[lang].name + `<br><span class="translation">${title}</span>`
            }
            translation = text
            text = data._i18n[lang].card_text
            try {
                const response = await fetch(data._i18n[lang].url)
                if (!response.ok) {
                    throw Error(response.statusText)
                }
                this.card_image.src = data._i18n[lang].url
            } catch (error) {}
        }
        this.card_title.innerHTML = title
        let pelem = document.createElement("p")
        pelem.classList.add("card-id")
        pelem.textContent = `#${data.id}`
        this.image_footer.appendChild(pelem)
        pelem = document.createElement("p")
        pelem.classList.add("card-print")
        if (Object.entries(data.sets).some(isInPrint)) {
            pelem.textContent = "Currently in print"
        } else {
            pelem.textContent = "Not in print"
        }
        if (window.getComputedStyle(this.card_sets).display === "none") {
            pelem.textContent += " ▶︎"
        } else {
            pelem.textContent += " ▼"
        }
        pelem.addEventListener("click", (ev) => this.toggleFold(ev))
        this.image_footer.appendChild(pelem)
        this.addCardText(text)
        if (translation) {
            this.card_text.appendChild(document.createElement("hr"))
            this.addCardText(translation, "translation")
        }
        let sets = Object.entries(data.sets)
        sets.sort(compareSet)
        this.card_sets.appendChild(document.createElement("hr"))
        for (let [name, info] of sets) {
            let set_info = document.createElement("div")
            set_info.classList.add("set-info")
            let set_name = document.createElement("p")
            set_name.classList.add("set-name")
            if (data._i18n && lang in data._i18n) {
                if (name in data._i18n[lang].sets) {
                    name = data._i18n[lang].sets[name]
                }
            }
            if (isInPrint([name, info])) {
                set_name.innerHTML = `<strong>${name}</strong>`
            } else {
                set_name.textContent = name
            }
            set_info.appendChild(set_name)
            let set_detail = document.createElement("div")
            set_detail.classList.add("set-detail")
            set_info.appendChild(set_detail)
            for (const card_print of info) {
                let set_print = document.createElement("p")
                set_print.classList.add("set-print")
                set_print.textContent = ""
                if ("rarity" in card_print) {
                    set_print.textContent += card_print.rarity
                }
                if ("precon" in card_print) {
                    set_print.textContent += card_print.precon
                }
                if ("copies" in card_print) {
                    set_print.textContent += ` (${card_print.copies})`
                }
                if ("release_date" in card_print) {
                    set_print.textContent += ` ${card_print.release_date.replace(/([^-]*)-/g, "$1‑")}`
                }
                set_detail.appendChild(set_print)
            }
            this.card_sets.appendChild(set_info)
        }
        let rulings_map = {}
        if (data.rulings && data.rulings.text) {
            let rulings_list = document.createElement("ul")
            rulings_list.setAttribute("class", "rulings-list")
            this.rulings.appendChild(rulings_list)
            for (const ruling of data.rulings.text) {
                const reference_re = /\[[a-zA-Z0-9]+\s[0-9-]+\]/g
                let ruling_item = document.createElement("li")
                ruling_item.innerHTML = formatText(ruling.replace(reference_re, ""))
                const references = [...ruling.matchAll(reference_re)]
                for (const reference of references) {
                    // use non-breaking spaces and hyphens
                    const non_breaking_ref = reference[0].replace(" ", " ").replace(/([^-]*)-/g, "$1‑")
                    const link = data.rulings.links[reference[0]]
                    ruling_item.innerHTML += ` <a target="_blank" href="${link}">${non_breaking_ref}</a >`
                    rulings_map[non_breaking_ref] = link
                }
                addCardEvents(ruling_item)
                rulings_list.appendChild(ruling_item)
            }
            // custom copy event to include ruling link
            rulings_list.addEventListener("copy", (event) => {
                const selection = document.getSelection()
                const markdown = selection.toString().replace(
                    RegExp(
                        Object.keys(rulings_map)
                            .map((x) => x.replace(/(\[|\])/g, "\\$1"))
                            .join("|"),
                        "g"
                    ),
                    (x) => `${x}(${rulings_map[x]})`
                )
                event.clipboardData.setData("text/plain", markdown)
                event.preventDefault()
            })
        } else {
            let pelem = document.createElement("p")
            pelem.textContent = "No ruling registered."
            this.rulings.appendChild(pelem)
        }
        this.results.style.display = "block"
    }
    async fetchCard(name) {
        const response = await fetch(encodeURI(`https://v2.api.krcg.org/card/${encodeUrlParam(name)}`), {
            method: "GET",
            headers: { Accept: "application/json" },
        })
        if (!response.ok) {
            if (response.status >= 500 && response.status < 600) {
                throw Error("KRCG bootstrapping, please wait...")
            } else if (response.status >= 404 && response.status < 600) {
                throw Error(`"${name}" not found.`)
            } else {
                throw Error(response.statusText)
            }
        }
        return await response.json()
    }
    toggleFold(ev) {
        let text = ev.target.textContent
        if (text.match(/▶︎/gu)) {
            ev.target.textContent = text.replace(/▶︎/gu, "▼")
            this.card_sets.style.display = "block"
        } else {
            ev.target.textContent = text.replace(/▼/gu, "▶︎")
            this.card_sets.style.display = "none"
        }
    }
    addCardText(text, cla) {
        const sections = text.split("\n")
        for (let [index, section] of sections.entries()) {
            let pelem = document.createElement("p")
            if (cla) {
                pelem.classList.add(cla)
            }
            if (
                sections.length > 1 &&
                ((index == 0 && section[0] != "[") ||
                    (section[0] == "[" && section[1].toUpperCase() == section[1] && section[4] == "]"))
            ) {
                pelem.innerHTML = `<strong>${formatText(section)}</strong>`
            } else {
                pelem.innerHTML = formatText(section)
            }
            addCardEvents(pelem)
            this.card_text.appendChild(pelem)
        }
    }
    async submitRuling(ev) {
        ev.preventDefault()
        let elements = ev.target.elements
        if (elements["submit"].disabled) {
            return
        }
        elements["submit"].disabled = true
        elements["result"].innerHTML = "<p>Please wait...</p>"
        try {
            const response = await fetch(
                encodeURI(`https://v2.api.krcg.org/submit-ruling/${encodeUrlParam(this.state.state.card)}`),
                {
                    method: "POST",
                    body: JSON.stringify({ text: elements["explanation"].value, link: elements["url"].value }),
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                }
            )
            if (!response.ok) {
                if (response.status >= 500 && response.status < 600) {
                    throw Error("KRCG bootstrapping, please try again in a minute.")
                } else if (response.status == 400) {
                    throw Error("You must provide a valid ruling link.")
                } else {
                    throw Error(response.statusText)
                }
            }
            let data = await response.json()
            elements[
                "result"
            ].innerHTML = `<p>Ruling submitted: you can consult it <a target="_blank", href="${data["html_url"]}">on GitHub</a>.`
            elements["explanation"].value = ""
            elements["url"].value = ""
        } catch (error) {
            elements["result"].innerHTML = `<p>${error.message}</p>`
        }
        elements["submit"].disabled = false
    }
}
function isInPrint(setInfo) {
    for (detail of setInfo[1]) {
        if ("release_date" in detail && detail.release_date >= "2017-05-01" && !setInfo[0].match(/(P|p)romo/g)) {
            if ("precon" in detail && detail.precon == "EC Berlin Edition") {
                return false
            }
            return true
        }
    }
    return false
}
const disc_map = {
    "[1 CONVICTION]": "<i>¤</i>",
    "[2 CONVICTION]": "<i>¤¤</i>",
    "[3 CONVICTION]": "<i>¤¤¤</i>",
    "[4 CONVICTION]": "<i>¤¤¤¤</i>",
    "[5 CONVICTION]": "<i>¤¤¤¤¤</i>",
    "[ACTION]": "<i>0</i>",
    "[POLITICAL ACTION]": "<i>2</i>",
    "[REACTION]": "<i>7</i>",
    "[ACTION MODIFIER]": "<i>1</i>",
    "[COMBAT]": "<i>4</i>",
    "[REFLEX]": "<i>6</i>",
    "[FLIGHT]": "<i>^</i>",
    "[MERGED]": "<i>µ </i>",
    "[abo]": "<i>w</i>",
    "[ABO]": "<i>W</i>",
    "[ani]": "<i>i</i>",
    "[ANI]": "<i>I</i>",
    "[aus]": "<i>a</i>",
    "[AUS]": "<i>A</i>",
    "[cel]": "<i>c</i>",
    "[CEL]": "<i>C</i>",
    "[chi]": "<i>k</i>",
    "[CHI]": "<i>K</i>",
    "[dai]": "<i>y</i>",
    "[DAI]": "<i>Y</i>",
    "[dem]": "<i>e</i>",
    "[DEM]": "<i>E</i>",
    "[dom]": "<i>d</i>",
    "[DOM]": "<i>D</i>",
    "[for]": "<i>f</i>",
    "[FOR]": "<i>F</i>",
    "[mal]": "<i>â </i>",
    "[MAL]": "<i>ã </i>",
    "[mel]": "<i>m</i>",
    "[MEL]": "<i>M</i>",
    "[myt]": "<i>x</i>",
    "[MYT]": "<i>X</i>",
    "[nec]": "<i>n</i>",
    "[NEC]": "<i>N</i>",
    "[obe]": "<i>b</i>",
    "[OBE]": "<i>B</i>",
    "[obf]": "<i>o</i>",
    "[OBF]": "<i>O</i>",
    "[obt]": "<i>$</i>",
    "[OBT]": "<i>£</i>",
    "[pot]": "<i>p</i>",
    "[POT]": "<i>P</i>",
    "[pre]": "<i>r</i>",
    "[PRE]": "<i>R</i>",
    "[pro]": "<i>j</i>",
    "[PRO]": "<i>J</i>",
    "[qui]": "<i>q</i>",
    "[QUI]": "<i>Q</i>",
    "[san]": "<i>g</i>",
    "[SAN]": "<i>G</i>",
    "[ser]": "<i>s</i>",
    "[SER]": "<i>S</i>",
    "[spi]": "<i>z</i>",
    "[SPI]": "<i>Z</i>",
    "[str]": "<i>à </i>",
    "[STR]": "<i>á </i>",
    "[tem]": "<i>?</i>",
    "[TEM]": "<i>!</i>",
    "[thn]": "<i>h</i>",
    "[THN]": "<i>H</i>",
    "[tha]": "<i>t</i>",
    "[THA]": "<i>T</i>",
    "[val]": "<i>l</i>",
    "[VAL]": "<i>L</i>",
    "[vic]": "<i>v</i>",
    "[VIC]": "<i>V</i>",
    "[vis]": "<i>u</i>",
    "[VIS]": "<i>U</i>",
}
function formatText(text) {
    // replace card names by span with card image popup (first as disciplines map introduce / in the text)
    // replace disciplines text with icons
    return text
        .replace(
            /(?:\s\/|\{)([^\/\}]*)(?:\/\s|\})/g,
            (_, x) => `<span class="krcg-card" data-name='${x}'">${x.replace(" ", " ")}</span>`
        )
        .replace(
            RegExp(
                Object.keys(disc_map)
                    .map((x) => x.replace(/(\[|\])/g, "\\$1"))
                    .join("|"),
                "g"
            ),
            (x) => disc_map[x]
        )
}
function compareSet(a, b) {
    a_date = Math.max(...a[1].map((o) => ("release_date" in o ? new Date(o.release_date) : new Date("1990-01-01"))))
    b_date = Math.max(...b[1].map((o) => ("release_date" in o ? new Date(o.release_date) : new Date("1990-01-01"))))
    const ret = b_date - a_date
    if (ret === 0) {
        return a[0].localeCompare(b[0])
    }
    return ret
}
function addCardEvents(pelem) {
    for (elem of pelem.children) {
        if (elem.classList.contains("krcg-card")) {
            elem.addEventListener("click", clickCard.bind(elem))
            elem.addEventListener("mouseover", overCard.bind(elem))
            elem.addEventListener("mouseout", outCard)
        }
    }
}
async function load() {
    let cardSearch = new CardSearch()
    await cardSearch.state.setup()
}
window.addEventListener("load", load)
import {SiteProjector} from "../../../framework/client/js/projector/siteProjector.js";
import {dom} from "../../../framework/client/js/util/dom.js";
import {ARTIST} from "./appTypes.js";

export const CrystalSiteProjector = siteController => {
    const originalProjector = SiteProjector(siteController);

    const projectBodyContent = () => {
        // Die funktionierende Oberfläche der Vorlage erzeugen.
        const content = originalProjector.projectBodyContent();
        const [header, main] = content;

        header.querySelector("h1").textContent = "Crystal ball";

        const [crystalSection] = dom(`
    <section class="crystal-selector" aria-label="Künstlerauswahl">

        <div class="orb-area">
            <div class="orb">
                <ul class="item-ring">
                    <li class="placeholder">
                        Hier erscheinen bald eure Künstler.
                    </li>
                </ul>
            </div>

            <div class="stand" aria-hidden="true">
                <div class="stand-neck"></div>
                <div class="stand-foot"></div>
            </div>

            <div class="selection-mode"
                 role="group"
                 aria-label="Auswahlmodus">
                <button type="button"
                        data-mode="single"
                        aria-pressed="true">
                    Single
                </button>

                <button type="button"
                        data-mode="multi"
                        aria-pressed="false">
                    Multi
                </button>
            </div>
        </div>

        <aside class="selection"
               aria-labelledby="crystal-selection-title">
            <p class="eyebrow">Deine Auswahl</p>

            <h2 id="crystal-selection-title">
                Ein kleiner Fund
            </h2>

            <p class="selection-copy">
                Hier erscheinen deine ausgewählten Künstler.
            </p>

            <ul class="selected-items"></ul>
        </aside>

    </section>
`);

        const ring = crystalSection.querySelector(".item-ring");
        const selectedItems = crystalSection.querySelector(".selected-items");

// Künstler nach ihrer ID speichern
        const artists = new Map();
        let selectedArtistId = null;
        const selectedIds = new Set();
        let selectionMode = "single";
        const modeButtons = crystalSection.querySelectorAll("[data-mode]");

        const renderArtists = () => {
            ring.replaceChildren();
            selectedItems.replaceChildren();

            if (artists.size === 0) {
                const message = document.createElement("li");
                message.className = "placeholder";
                message.textContent = "Keine Künstler vorhanden.";
                ring.append(message);
                return;
            }

            const artistList = [...artists.values()];

            const selectedIndex = artistList.findIndex(
                artist => artist.id === selectedArtistId
            );

// Ohne aktuelle Künstlerauswahl beginnt die Ansicht beim ersten Eintrag.
            const centerIndex = selectedIndex >= 0 ? selectedIndex : 0;
            const visibleCount = Math.min(5, artistList.length);
            const middle = Math.floor(visibleCount / 2);

// Die Liste wird kreisförmig angeordnet.
// Jeder Künstler erscheint höchstens einmal.
            const visibleArtists = Array.from(
                {length: visibleCount},
                (_, position) => {
                    const offset = position - middle;
                    const index =
                        (centerIndex + offset + artistList.length) % artistList.length;

                    return {
                        artist: artistList[index],
                        distance: Math.abs(offset)
                    };
                }
            );

            visibleArtists.forEach(({artist, distance}) => {
                const item = document.createElement("li");
                item.className = "data-item";

                const button = document.createElement("button");
                button.type = "button";
                button.textContent = artist.displayedAs;

                const isSelected = selectedIds.has(artist.id);
                button.setAttribute("aria-pressed", String(isSelected));

                if (distance === 0) {
                    item.classList.add("focused");
                } else if (distance === 1) {
                    item.classList.add("adjacent");
                } else {
                    item.classList.add("distant");
                }

                button.onclick = () => {
                    // Dieselbe Auswahl wie in der ursprünglichen Künstlerliste
                    // Dadurch wird auch das bestehende Formular geöffnet
                    siteController.setSelection({
                        entityName: ARTIST,
                        entity: artist
                    });
                };

                item.append(button);
                ring.append(item);
            });

            selectedIds.forEach(id => {
                const artist = artists.get(id);
                if (!artist) return;

                const item = document.createElement("li");
                item.className = "selected-item";

                const name = document.createElement("span");
                name.textContent = `✧ ${artist.displayedAs}`;
                item.append(name);

                if (selectionMode === "multi") {
                    const removeButton = document.createElement("button");
                    removeButton.type = "button";
                    removeButton.className = "remove-selection";
                    removeButton.textContent = "×";
                    removeButton.setAttribute(
                        "aria-label",
                        `${artist.displayedAs} aus Auswahl entfernen`
                    );

                    removeButton.onclick = () => {
                        selectedIds.delete(id);
                        renderArtists();

                        // Nach dem Neuaufbau einen erreichbaren Fokus setzen.
                        const nextButton = selectedItems.querySelector("button");
                        const multiButton =
                            crystalSection.querySelector('[data-mode="multi"]');

                        (nextButton ?? multiButton).focus();
                    };

                    item.append(removeButton);
                }

                selectedItems.append(item);
            });
        };

        modeButtons.forEach(button => {
            button.onclick = () => {
                selectionMode = button.dataset.mode;

                modeButtons.forEach(modeButton => {
                    modeButton.setAttribute(
                        "aria-pressed",
                        String(modeButton.dataset.mode === selectionMode)
                    );
                });

                if (selectionMode === "single") {
                    // Den aktuell bearbeiteten Künstler behalten.
                    // Falls keiner aktiv ist, den ersten aus der Merkliste nehmen.
                    const keepId = artists.has(selectedArtistId)
                        ? selectedArtistId
                        : [...selectedIds][0];

                    selectedIds.clear();

                    if (keepId !== undefined && artists.has(keepId)) {
                        selectedIds.add(keepId);
                        selectedArtistId = keepId;

                        siteController.setSelection({
                            entityName: ARTIST,
                            entity: artists.get(keepId)
                        });
                    }
                }

                renderArtists();
            };
        });

        siteController.onSelection(({entityName, entity}) => {
            if (entityName === ARTIST) {
                artists.set(entity.id, entity);
                selectedArtistId = entity.id;

                if (selectionMode === "single") {
                    selectedIds.clear();
                }

                selectedIds.add(entity.id);
            } else {
                selectedArtistId = null;

                if (selectionMode === "single") {
                    selectedIds.clear();
                }
            }

            renderArtists();
        });

// Neu erstellte oder bearbeitete Künstler in der Kugel aktualisieren
        const updateArtist = ({entityName, entity}) => {
            if (entityName !== ARTIST) return;

            artists.set(entity.id, entity);
            renderArtists();
        };

        siteController.onEntityAdded(updateArtist);
        siteController.onEntityChanged(updateArtist);

// Gelöschte Künstler auch aus der Kugel entfernen
        siteController.onEntityRemoved(({entityName, entity}) => {
            if (entityName !== ARTIST) return;

            artists.delete(entity.id);
            selectedIds.delete(entity.id);

            if (selectedArtistId === entity.id) {
                selectedArtistId = null;
            }

            renderArtists();
        });

// Vorhandene Künstler über den Service der Vorlage laden
        siteController.getEntityService(ARTIST).getAll()
            .then(entities => {
                entities.forEach(entity => artists.set(entity.id, entity));
                renderArtists();
            })
            .catch(error => {
                console.error("Künstler konnten nicht geladen werden:", error);

                const message = document.createElement("li");
                message.className = "placeholder";
                message.textContent = "Künstler konnten nicht geladen werden.";
                ring.replaceChildren(message);
            });

        // Die neue Ansicht vor der bisherigen Verwaltung einfügen.
        main.prepend(crystalSection);

        return content;
    };

    return {
        ...originalProjector,
        projectBodyContent
    };
};
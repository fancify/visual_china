import type { KnowledgeFragment } from "../data/fragments";

export interface JournalRefs {
  journal: HTMLElement;
  journalEmpty: HTMLElement;
  journalList: HTMLElement;
  journalDetail: HTMLElement;
}

export interface RenderJournalOptions {
  refs: JournalRefs;
  open: boolean;
  collected: KnowledgeFragment[];
  selectedFragmentId: string | null;
  onSelect(fragmentId: string): void;
}

function renderDetail(fragment: KnowledgeFragment): string {
  return `
    <div class="detail-zone">${fragment.zone}</div>
    <h3>${fragment.title}</h3>
    <p class="detail-pickup">${fragment.pickupLine}</p>
    <div class="detail-copy">
      <h4>地理</h4>
      <p>${fragment.details.geo}</p>
      <h4>历史</h4>
      <p>${fragment.details.history}</p>
      <h4>战略</h4>
      <p>${fragment.details.strategy}</p>
    </div>
  `;
}

export function renderJournalView({
  refs,
  open,
  collected,
  selectedFragmentId,
  onSelect
}: RenderJournalOptions): string | null {
  refs.journal.classList.toggle("open", open);
  refs.journalEmpty.style.display = collected.length === 0 ? "block" : "none";
  refs.journalList.style.display = collected.length === 0 ? "none" : "flex";
  refs.journalDetail.style.display = collected.length === 0 ? "none" : "block";

  if (collected.length === 0) {
    refs.journalList.innerHTML = "";
    refs.journalDetail.innerHTML = "";
    return null;
  }

  const active =
    collected.find((fragment) => fragment.id === selectedFragmentId) ??
    collected[collected.length - 1]!;

  refs.journalList.innerHTML = collected
    .map(
      (fragment) => `
        <button
          type="button"
          class="journal-item ${fragment.id === active.id ? "active" : ""}"
          data-fragment-id="${fragment.id}"
        >
          <span>${fragment.zone}</span>
          <strong>${fragment.title}</strong>
        </button>
      `
    )
    .join("");

  refs.journalDetail.innerHTML = renderDetail(active);

  refs.journalList
    .querySelectorAll<HTMLButtonElement>(".journal-item")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const fragmentId = button.dataset.fragmentId;

        if (fragmentId) {
          onSelect(fragmentId);
        }
      });
    });

  return active.id;
}

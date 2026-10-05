import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { CardCreateRequest, CardSummary, CardUpdateRequest, createCard, deleteCard, listCards, updateCard } from "../api/card";
import { Tag } from "../types";
import { allLocalizedValues, pickLocalized, useLocaleText } from "./useLocaleText";


export function useCardManager() {
  const cards = ref<CardSummary[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { t } = useI18n();
  const { currentLocale } = useLocaleText();

  const searchQuery = ref("");
  const selectedTagFilter = ref<Tag | null>(null);
  const filteredCards = computed(() => {
    let result = cards.value;

    // 文本搜索: 命中任意一种语言的文本都算匹配
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLocaleLowerCase();
      result = cards.value.filter(card => 
        allLocalizedValues(card.content).some(text => text.toLocaleLowerCase().includes(q))
        || allLocalizedValues(card.title).some(text => text.toLocaleLowerCase().includes(q))
      )
    }

    return result
  })

  /** 卡片在当前界面语言下的显式内容 (缺失时回退到默认语言) */
  function displayContent(card: CardSummary): string {
    return pickLocalized(card.content, currentLocale.value);
  }

  async function loadCards() {
    loading.value = true;
    error.value = null;
    try {
      // Uuid v7 时间有序, 后端已按 global_id 升序排号 (相当于按创建时间排序)
      cards.value = await listCards();
    } catch (e) {
      error.value = t("card.loadFailed", { error: e });
    } finally {
      loading.value = false;
    }
  }

  async function create(req: CardCreateRequest): Promise<CardSummary | null> {
    loading.value = true;
    error.value = null;
    try {
      const newCard = await createCard(req);
      cards.value.unshift(newCard);
      return newCard;
    } catch (e) {
      error.value = t("card.createFailed", { error: e });
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function update(req: CardUpdateRequest): Promise<CardSummary | null> {
    loading.value = true;
    error.value = null;
    try {
      const updated = await updateCard(req);
      const index = cards.value.findIndex(c => c.global_id === req.global_id);
      if (index !== -1) {
        cards.value[index] = updated;
      } else {
        // 只读来源的卡片更新时会分叉出新的 global_id, 直接加入列表
        cards.value.unshift(updated);
      }
      return updated;
    } catch (e) {
      error.value = t("card.updateFailed", { error: e });
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function remove(globalId: string): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      await deleteCard(globalId);
      cards.value = cards.value.filter(c => c.global_id !== globalId);
      return true;
    } catch (e) {
      error.value = t("card.deleteError", { error: e });
      return false;
    } finally {
      loading.value = false;
    }
  }

  const allUsedTags = computed(() => {
    const tagMap = new Map<string, Tag>();
    for (const card of cards.value) {
      for (const tag of card.tags) {
        const key = `${tag.namespace}:${tag.value}`;
        if (!tagMap.has(key)) {
          tagMap.set(key, tag);
        }
      }
    }
    return Array.from(tagMap.values());
  })

  return {
    cards,
    loading,
    error,
    searchQuery,
    filteredCards,
    allUsedTags,
    selectedTagFilter,
    displayContent,
    loadCards,
    create,
    update,
    remove,
  }
}

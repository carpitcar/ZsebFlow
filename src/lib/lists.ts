import { supabase } from './supabase'
import type {
  CreateListItemPayload,
  CreateListPayload,
  List,
  ListItem,
  ListWithItems,
  UpdateListItemPayload,
  UpdateListPayload,
} from '../types/lists'

const listSelect = '*, items:list_items(*)'

const sortLists = (lists: ListWithItems[]) =>
  [...lists].sort((first, second) =>
    second.created_at.localeCompare(first.created_at),
  )

const normalizeList = (list: List & { items?: ListItem[] | null }): ListWithItems => ({
  ...list,
  items: [...(list.items ?? [])].sort(
    (first, second) =>
      first.sort_order - second.sort_order ||
      first.created_at.localeCompare(second.created_at),
  ),
})

export async function loadLists(userId: string) {
  const { data, error } = await supabase
    .from('lists')
    .select(listSelect)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return {
    data: sortLists(((data ?? []) as Array<List & { items?: ListItem[] }>).map(normalizeList)),
    error,
  }
}

export async function createList(payload: CreateListPayload) {
  const { data, error } = await supabase
    .from('lists')
    .insert(payload)
    .select(listSelect)
    .single()

  return { data: data ? normalizeList(data as List & { items?: ListItem[] }) : null, error }
}

export async function updateList(listId: string, payload: UpdateListPayload) {
  const { data, error } = await supabase
    .from('lists')
    .update(payload)
    .eq('id', listId)
    .select(listSelect)
    .single()

  return { data: data ? normalizeList(data as List & { items?: ListItem[] }) : null, error }
}

export const archiveList = (listId: string) => updateList(listId, { is_archived: true })
export const unarchiveList = (listId: string) => updateList(listId, { is_archived: false })

export async function deleteList(listId: string) {
  return supabase.from('lists').delete().eq('id', listId)
}

export async function loadListItems(listId: string) {
  const { data, error } = await supabase
    .from('list_items')
    .select('*')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return { data: (data ?? []) as ListItem[], error }
}

export async function createListItem(payload: CreateListItemPayload) {
  const { data, error } = await supabase
    .from('list_items')
    .insert({
      priority: 'normal',
      ...payload,
    })
    .select('*')
    .single()

  return { data: data as ListItem | null, error }
}

export async function updateListItem(
  itemId: string,
  payload: UpdateListItemPayload,
) {
  const { data, error } = await supabase
    .from('list_items')
    .update(payload)
    .eq('id', itemId)
    .select('*')
    .single()

  return { data: data as ListItem | null, error }
}

export async function toggleListItemCompleted(item: ListItem) {
  return updateListItem(item.id, {
    is_completed: !item.is_completed,
    completed_at: item.is_completed ? null : new Date().toISOString(),
  })
}

export async function deleteListItem(itemId: string) {
  return supabase.from('list_items').delete().eq('id', itemId)
}

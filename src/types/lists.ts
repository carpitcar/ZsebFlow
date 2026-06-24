export type ListType = 'shopping' | 'tasks' | 'reminder' | 'custom'
export type ListPriority = 'low' | 'normal' | 'high'

export type List = {
  id: string
  user_id: string
  title: string
  description: string | null
  list_type: ListType
  icon: string | null
  color: string | null
  due_date: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export type ListItem = {
  id: string
  list_id: string
  title: string
  notes: string | null
  quantity: number | string | null
  unit: string | null
  due_at: string | null
  priority: ListPriority
  is_completed: boolean
  completed_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type ListWithItems = List & {
  items: ListItem[]
}

export type CreateListPayload = {
  user_id: string
  title: string
  description?: string | null
  list_type: ListType
  icon?: string | null
  color?: string | null
  due_date?: string | null
}

export type UpdateListPayload = Partial<
  Pick<List, 'title' | 'description' | 'list_type' | 'icon' | 'color' | 'due_date' | 'is_archived'>
>

export type CreateListItemPayload = {
  list_id: string
  title: string
  notes?: string | null
  quantity?: number | null
  unit?: string | null
  due_at?: string | null
  priority?: ListPriority
  sort_order?: number
}

export type UpdateListItemPayload = Partial<
  Pick<
    ListItem,
    | 'title'
    | 'notes'
    | 'quantity'
    | 'unit'
    | 'due_at'
    | 'priority'
    | 'is_completed'
    | 'completed_at'
    | 'sort_order'
  >
>

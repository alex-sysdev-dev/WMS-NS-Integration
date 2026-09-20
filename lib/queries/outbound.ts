import type {
  InboundQaQueueItem,
  InventoryItem,
  InventoryRisk,
  OutboundFloorData,
  PackStation,
  PackStationStatus,
  PickTask,
  PickTaskStatus,
} from '@/types/outbound'

type RawRow = Record<string, unknown>

const STATUS_SORT_ORDER: Record<PickTaskStatus, number> = {
  blocked: 0,
  picking: 1,
  queued: 2,
  packed: 3,
  unknown: 4,
  completed: 5,
}

function pickString(row: RawRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }

    if (typeof value === 'number') {
      return String(value)
    }
  }

  return null
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isGenericStationName(value: string | null): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  if (isUuidLike(normalized)) {
    return true
  }

  return /^station[-\s]?[0-9a-f-]{8,}$/i.test(normalized)
}

function pickPreferredStationLabel(row: RawRow, primaryKeys: string[], fallbackKeys: string[]): string | null {
  const primary = pickString(row, primaryKeys)
  if (primary && !isGenericStationName(primary)) {
    return primary
  }

  return pickString(row, fallbackKeys) ?? primary
}

function pickNumber(row: RawRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return null
}

function toTime(value: string | null): number {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function parseGridCoordinate(label: string | null): { row: number | null; column: number | null } {
  if (!label) {
    return { row: null, column: null }
  }

  const normalized = label.trim().toUpperCase()
  const match = normalized.match(/^([A-Z])[-\s]?(\d{1,2})$/)
  if (!match) {
    return { row: null, column: null }
  }

  const row = match[1].charCodeAt(0) - 64
  const column = Number(match[2])
  if (!Number.isFinite(row) || !Number.isFinite(column)) {
    return { row: null, column: null }
  }

  return { row, column }
}

function normalizePickTaskStatus(value: string | null): PickTaskStatus {
  const normalized = value?.toLowerCase()
  if (!normalized) {
    return 'unknown'
  }

  if (normalized.includes('complete') || normalized.includes('done') || normalized.includes('closed')) {
    return 'completed'
  }

  if (normalized.includes('block') || normalized.includes('hold') || normalized.includes('exception')) {
    return 'blocked'
  }

  if (normalized.includes('pack')) {
    return 'packed'
  }

  if (normalized.includes('progress') || normalized.includes('active') || normalized.includes('pick')) {
    return 'picking'
  }

  if (normalized.includes('queue') || normalized.includes('new') || normalized.includes('ready') || normalized.includes('open')) {
    return 'queued'
  }

  return 'unknown'
}

function normalizeStationStatus(value: string | null): PackStationStatus {
  const normalized = value?.toLowerCase()
  if (!normalized) {
    return 'unknown'
  }

  if (normalized.includes('maint') || normalized.includes('repair') || normalized.includes('service')) {
    return 'maintenance'
  }

  if (normalized.includes('off') || normalized.includes('down')) {
    return 'offline'
  }

  if (normalized.includes('block') || normalized.includes('hold') || normalized.includes('error')) {
    return 'blocked'
  }

  if (normalized.includes('idle') || normalized.includes('ready') || normalized.includes('standby')) {
    return 'idle'
  }

  if (normalized.includes('active') || normalized.includes('busy') || normalized.includes('running')) {
    return 'active'
  }

  return 'unknown'
}

function normalizePriority(value: number | null, label: string | null): number {
  if (value !== null) {
    return Math.max(1, Math.round(value))
  }

  const normalized = label?.toLowerCase()
  if (!normalized) {
    return 2
  }

  if (normalized.includes('critical') || normalized.includes('urgent') || normalized.includes('high')) {
    return 4
  }

  if (normalized.includes('medium')) {
    return 3
  }

  if (normalized.includes('low')) {
    return 1
  }

  return 2
}

function normalizeInventoryRisk(netQty: number, reorderPoint: number): InventoryRisk {
  if (netQty <= reorderPoint) {
    return 'critical'
  }

  if (netQty <= reorderPoint * 1.5) {
    return 'watch'
  }

  return 'healthy'
}

function normalizePickTask(row: RawRow, index: number): PickTask {
  const id = pickString(row, ['id', 'task_id']) ?? `task-${index + 1}`
  const taskNumber = pickString(row, ['task_number', 'wave_task', 'pick_id', 'id']) ?? `TASK-${index + 1}`
  const orderNumber = pickString(row, ['order_number', 'order_id', 'shipment_id'])
  const sku = pickString(row, ['sku', 'product_id', 'item_id']) ?? 'Unknown SKU'
  const zone = pickString(row, ['zone', 'pick_zone', 'aisle', 'area']) ?? 'General'
  const quantity = Math.max(1, pickNumber(row, ['qty', 'quantity', 'expected_qty']) ?? 1)
  const pickedQty = Math.max(0, pickNumber(row, ['picked_qty', 'completed_qty', 'done_qty']) ?? 0)
  const remainingQty = Math.max(quantity - pickedQty, 0)
  const status = normalizePickTaskStatus(pickString(row, ['status', 'task_status']))
  const priority = normalizePriority(
    pickNumber(row, ['priority', 'priority_score', 'priority_rank']),
    pickString(row, ['priority_label', 'priority_bucket'])
  )
  const assignedStation = pickPreferredStationLabel(
    row,
    ['station_name'],
    ['pack_station', 'station_code', 'station_id', 'assigned_station']
  )
  const assignedStationId = pickString(row, ['pick_pack_station_id'])

  return {
    id,
    taskNumber,
    orderNumber,
    sku,
    zone,
    status,
    priority,
    quantity,
    pickedQty,
    remainingQty,
    assignedStationId,
    assignedStation,
    dueAt: pickString(row, ['due_at', 'sla_at', 'ship_by', 'needed_by']),
    updatedAt: pickString(row, ['updated_at', 'started_at', 'created_at']),
  }
}

function normalizeStation(row: RawRow, index: number): PackStation {
  const id = pickString(row, ['id', 'station_id']) ?? `station-${index + 1}`
  const label =
    pickPreferredStationLabel(row, ['station_name'], ['station_code', 'name', 'label', 'id']) ?? `ST-${index + 1}`
  const queueDepth = Math.max(0, pickNumber(row, ['queue_depth', 'queue', 'active_task_count', 'pending_tasks']) ?? 0)

  const rawUtilization = pickNumber(row, ['utilization', 'utilization_pct', 'utilization_percent'])
  const utilization = Math.max(
    0,
    Math.min(100, rawUtilization === null ? queueDepth * 12 : rawUtilization <= 1 ? rawUtilization * 100 : rawUtilization)
  )

  const grid = parseGridCoordinate(label)

  return {
    id,
    label,
    status: normalizeStationStatus(pickString(row, ['status', 'station_status', 'state'])),
    operator: pickString(row, ['operator_name', 'associate_name', 'user_name', 'current_operator']),
    queueDepth,
    utilization: Number(utilization.toFixed(1)),
    row: pickNumber(row, ['row', 'row_index', 'y']) ?? grid.row,
    column: pickNumber(row, ['column', 'col', 'col_index', 'x']) ?? grid.column,
    activeTaskNumber: pickString(row, ['current_task', 'active_task', 'current_order']),
    updatedAt: pickString(row, ['updated_at', 'last_scan_at', 'last_activity_at']),
  }
}

function normalizeInventoryItem(row: RawRow, index: number): InventoryItem {
  const id = pickString(row, ['id', 'inventory_id']) ?? `inventory-${index + 1}`
  const sku = pickString(row, ['sku', 'product_id', 'item_id']) ?? `SKU-${index + 1}`
  const availableQty = Math.max(0, pickNumber(row, ['available_qty', 'on_hand_qty', 'quantity']) ?? 0)
  const reservedQty = Math.max(0, pickNumber(row, ['reserved_qty', 'allocated_qty', 'hold_qty']) ?? 0)
  const netQty = availableQty - reservedQty
  const reorderPoint = Math.max(1, pickNumber(row, ['reorder_point', 'min_qty', 'safety_stock']) ?? 10)

  return {
    id,
    sku,
    location: pickString(row, ['location', 'bin_location', 'zone', 'aisle']) ?? 'Unknown location',
    availableQty,
    reservedQty,
    netQty,
    reorderPoint,
    velocity: pickString(row, ['velocity_class', 'velocity', 'abc_class']),
    risk: normalizeInventoryRisk(netQty, reorderPoint),
    updatedAt: pickString(row, ['updated_at', 'last_counted_at', 'created_at']),
  }
}

/**
 * No source. `pick_tasks`, `pick_pack_stations`, and `inventory` were scaffolding
 * tables and Supabase is gone, so every caller degrades to an empty list until
 * outbound reads NetSuite.
 *
 * Inventory in particular cannot be a straight port: it is lot-tracked and
 * never serialized, so a replacement row carries item, lot, bin, and qty rather
 * than the flat sku-and-location shape normalized below.
 */
async function getTableRows(_table: string): Promise<RawRow[]> {
  return []
}

export async function getPickTasks(): Promise<PickTask[]> {
  const rows = await getTableRows('pick_tasks')
  const tasks = rows.map(normalizePickTask)

  return tasks.sort((a, b) => {
    const statusRank = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]
    if (statusRank !== 0) {
      return statusRank
    }

    if (a.priority !== b.priority) {
      return b.priority - a.priority
    }

    return toTime(a.dueAt) - toTime(b.dueAt)
  })
}

export async function getPickPackStations(): Promise<PackStation[]> {
  const rows = await getTableRows('pick_pack_stations')

  return rows
    .map(normalizeStation)
    .sort((a, b) => {
      if (a.row !== null && b.row !== null && a.row !== b.row) {
        return a.row - b.row
      }
      if (a.column !== null && b.column !== null && a.column !== b.column) {
        return a.column - b.column
      }

      return a.label.localeCompare(b.label)
    })
}

export async function getInventoryView(): Promise<InventoryItem[]> {
  const rows = await getTableRows('inventory')
  const riskOrder: Record<InventoryRisk, number> = { critical: 0, watch: 1, healthy: 2 }

  return rows
    .map(normalizeInventoryItem)
    .sort((a, b) => {
      if (riskOrder[a.risk] !== riskOrder[b.risk]) {
        return riskOrder[a.risk] - riskOrder[b.risk]
      }

      return a.netQty - b.netQty
    })
}

/**
 * NOT YET CONNECTED.
 *
 * This queue was assembled from Supabase shipment, item, and qa_inspections
 * rows. Fabrication quality is being rebuilt from zero against NetSuite and no
 * quality record is read from Supabase any more, so this returns nothing rather
 * than a stale or invented queue.
 */
export async function getInboundQaQueue(): Promise<InboundQaQueueItem[]> {
  return []
}

function resolveTaskStationAssignments(tasks: PickTask[], stations: PackStation[]): PickTask[] {
  const stationById = new Map(stations.map((station) => [station.id, station]))

  return tasks.map((task) => {
    if (!task.assignedStationId) {
      return task
    }

    const station = stationById.get(task.assignedStationId)
    if (!station) {
      return task
    }

    return {
      ...task,
      assignedStation: station.label,
    }
  })
}

export async function getOutboundFloorData(): Promise<OutboundFloorData> {
  const [tasks, stations, inventory, inboundQaQueue] = await Promise.all([
    getPickTasks(),
    getPickPackStations(),
    getInventoryView(),
    getInboundQaQueue(),
  ])

  const resolvedTasks = resolveTaskStationAssignments(tasks, stations)

  return {
    tasks: resolvedTasks,
    stations,
    inventory,
    inboundQaQueue,
  }
}

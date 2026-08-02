import { serverSupabase } from '@/lib/supabase-server'
import { InboundItem, Shipment, ShipmentStatus } from '@/types/inbound'
import { logQueryError } from '@/lib/queries/query-log'

type RawInboundItem = {
  id: string
  shipment_id: string
  product_id: string
  expected_qty: number | null
  received_qty: number | null
}

type RawShipmentMeta = {
  id: string
  supplier: string | null
  eta: string | null
  status: string | null
}

function normalizeShipmentStatus(value: string | null): ShipmentStatus | 'unknown' {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'scheduled' || normalized === 'arrived' || normalized === 'received') {
    return normalized
  }

  return 'unknown'
}

export async function getInboundShipments(): Promise<Shipment[]> {
  const { data, error } = await serverSupabase
    .from('inbound_shipments')
    .select('*')
    .order('eta', { ascending: true })

  if (error) {
    logQueryError('Inbound fetch error:', error)
    // Degrade to an empty list rather than rethrowing. Every other query in this
    // layer returns empty on failure; throwing here made an unreachable database
    // a 500 on /inbound instead of a page with no rows.
    return []
  }

  return (data as Shipment[] | null) ?? []
}

export async function getInboundItems(): Promise<InboundItem[]> {
  const [{ data: itemRows, error: itemError }, { data: shipmentRows, error: shipmentError }] = await Promise.all([
    serverSupabase.from('inbound_items').select('id, shipment_id, product_id, expected_qty, received_qty'),
    serverSupabase.from('inbound_shipments').select('id, supplier, eta, status'),
  ])

  // Degrade to an empty list rather than rethrowing, matching the rest of this
  // layer. An unreachable database should render an empty page, not a 500.
  if (itemError) {
    logQueryError('Inbound items fetch error:', itemError)
    return []
  }

  if (shipmentError) {
    logQueryError('Inbound shipment metadata fetch error:', shipmentError)
    return []
  }

  const shipmentsById = new Map<string, RawShipmentMeta>(
    ((shipmentRows as RawShipmentMeta[] | null) ?? []).map((shipment) => [shipment.id, shipment])
  )

  return ((itemRows as RawInboundItem[] | null) ?? []).map((item) => {
    const shipment = shipmentsById.get(item.shipment_id)
    return {
      id: item.id,
      shipment_id: item.shipment_id,
      product_id: item.product_id,
      expected_qty: item.expected_qty ?? 0,
      received_qty: item.received_qty ?? 0,
      supplier: shipment?.supplier ?? 'Unknown supplier',
      eta: shipment?.eta ?? null,
      status: normalizeShipmentStatus(shipment?.status ?? null),
    }
  })
}

/**
 * Order status by CPT risk, retired with its source.
 *
 * This served the `order_cpt_risk` view from the scaffolding this project was
 * started from. That store is gone, and CPT (critical pull time) never
 * described LED Connection anyway: it assumes orders race a daily
 * parcel-carrier cutoff, while LED ships
 * project freight and treats the project, not the sales order, as the unit of
 * work.
 *
 * The endpoint stays so callers get a truthful answer instead of a 500 from a
 * client pointed at nothing. It answers 503, because the data is missing rather
 * than the request being wrong.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const orderNumber = searchParams.get('order_number')

  if (!id && !orderNumber) {
    return Response.json(
      { error: 'bad_request', message: 'Provide id or order_number.', hint: 'At least one identifier is required.' },
      { status: 400 }
    )
  }

  return Response.json(
    {
      error: 'source_unavailable',
      message: 'Order status has no data source. CPT risk was retired and has no NetSuite replacement.',
      found: false,
      data: null,
    },
    { status: 503 }
  )
}

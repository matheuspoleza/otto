import type { PRLensData } from '../_lib/types';

export const samplePR: PRLensData = {
  meta: {
    owner: 'cravou',
    repo: 'api',
    number: 1325,
    title: 'Add installments to checkout',
    subtitle:
      'Customers can now split payments into up to 12 installments at checkout, with interest applied for 4+ installments.',
    author: 'matheus',
    state: 'merged',
    mergedAt: '2026-05-12T08:00:00.000Z',
    stateLabel: 'merged 2h ago',
    htmlUrl: 'https://github.com/cravou/api/pull/1325',
    headSha: 'fixture-sha',
  },
  risk: {
    score: 73,
    level: 'Medium',
    signals: [
      { type: 'warn', text: 'Breaking change for existing checkout integrations' },
      { type: 'warn', text: 'No feature flag — rolls out to 100% on merge' },
      { type: 'warn', text: 'Touches production billing flow' },
      { type: 'good', text: '12 tests cover the new payment paths' },
    ],
  },
  domains: ['Billing', 'Checkout'],
  actions: [
    { iconKind: 'doc', text: 'Update public API documentation', urgency: 'Before merge' },
    { iconKind: 'bell', text: 'Notify #support about installment refund flow', urgency: 'Before merge' },
    { iconKind: 'flask', text: 'Add QA scenarios for 4+ installment edge cases', urgency: 'After merge' },
    { iconKind: 'chat', text: 'Draft changelog entry for customers', urgency: 'After merge' },
  ],
  changes: {
    ui: {
      count: 2,
      description:
        'A new installment selector appears on the payment step. The order summary now displays the installment breakdown when applicable.',
      changedComponents: [
        {
          file: 'app/checkout/payment-form.tsx',
          name: 'PaymentForm',
          changeType: 'modified',
          summary: 'Adds installment selector below the card input.',
        },
        {
          file: 'app/checkout/order-summary.tsx',
          name: 'OrderSummary',
          changeType: 'modified',
          summary: 'Shows installment breakdown when 2+ installments are selected.',
        },
      ],
      screenshots: [],
      warning:
        'Existing customers in checkout will see a new selector. Test on mobile — 12 installment rows may overflow on small screens.',
    },
    api: {
      count: 3,
      description:
        'The checkout endpoint now accepts an installments parameter (1-12). The response includes installment breakdown for orders with 2+ installments.',
      endpoints: [
        {
          method: 'POST',
          path: '/api/checkout',
          changeType: 'modified',
          requestBefore: {
            amount: 1200.0,
            payment_method: 'credit_card',
            card_token: 'tok_abc123',
          },
          requestAfter: {
            amount: 1200.0,
            payment_method: 'credit_card',
            card_token: 'tok_abc123',
            installments: 6,
          },
          responseBefore: null,
          responseAfter: null,
          breakingReason: null,
        },
      ],
      warning:
        'Mobile clients sending requests without the new field will default to 1 installment. Notify the mobile team.',
    },
    data: {
      count: 2,
      description:
        'A new installments table tracks individual installment records linked to orders. Two new columns added to the orders table.',
      newTables: [
        {
          name: 'installments',
          columns: [
            { name: 'id', type: 'uuid', isPrimaryKey: true },
            { name: 'order_id', type: 'uuid', foreignKey: 'orders.id' },
            { name: 'sequence', type: 'int (1-12)' },
            { name: 'amount', type: 'numeric(10,2)' },
            { name: 'due_date', type: 'date' },
            { name: 'status', type: "enum: 'pending' | 'paid' | 'overdue'" },
          ],
        },
      ],
      modifiedTables: [
        {
          name: 'orders',
          addedColumns: [
            { name: 'installment_count', type: 'int default 1' },
            { name: 'has_interest', type: 'boolean default false' },
          ],
          droppedColumns: [],
          typeChanges: [],
        },
      ],
      droppedTables: [],
      isReversible: false,
      warning: 'Migration runs on deploy and is not reversible. Backup recommended before merge.',
    },
    business: {
      count: 1,
      description:
        'A new pricing rule applies interest to installment plans with 4 or more payments.',
      rules: [
        {
          name: 'Interest rule for installments',
          beforeText: 'All installment plans have 0% interest, regardless of count.',
          afterText: 'Plans with 4+ installments accrue 2.5% / month interest.',
          beforeExamples: [
            '1× installment → R$ 1.200,00',
            '6× installments → R$ 1.200,00 total',
            '12× installments → R$ 1.200,00 total',
          ],
          afterExamples: [
            '1×–3× installments → no interest',
            '4× installments → R$ 1.230,00 total',
            '12× installments → R$ 1.560,00 total',
          ],
          highlights: ['0%', '4+ installments', '2.5% / month'],
        },
      ],
      warning:
        'Customers choosing 4+ installments will pay more than the listed price. Make sure the UI shows interest clearly before confirmation.',
    },
  },
};

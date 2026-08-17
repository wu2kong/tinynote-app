/**
 * TinyNote × Dodo Payments (Live)
 *
 * 填入 Dodo Dashboard → Live Mode → Products 里的 Product ID
 * （形如 pdt_xxxxxxxx）。也可用完整 Payment Link。
 */
window.TINYNOTE_DODO = {
  mode: 'live',
  /** Live Product ID */
  productId: 'pdt_0NlM2WA3UNj0dcg3HeQvo',
  /**
   * 完整支付链接（优先于 productId）。
   */
  paymentLink: 'https://checkout.dodopayments.com/buy/pdt_0NlM2WA3UNj0dcg3HeQvo?quantity=1',
  /** 展示价（与 Dodo 商品价格保持一致） */
  priceLabel: '$14.99',
  priceNote: '',
  /** 结账完成后回到本站的锚点 */
  returnHash: 'buy',
};

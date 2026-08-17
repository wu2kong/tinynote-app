(function () {
  var cfg = window.TINYNOTE_DODO || {};
  var CHECKOUT_BUY_BASE = 'https://checkout.dodopayments.com/buy/';

  function t(key, params, fallback) {
    if (window.TinyNoteI18n && typeof window.TinyNoteI18n.t === 'function') {
      return window.TinyNoteI18n.t(key, params);
    }
    return fallback || key;
  }

  function getReturnUrl() {
    var hash = (cfg.returnHash || 'buy').replace(/^#/, '');
    var url = new URL(window.location.href);
    url.search = '';
    url.hash = hash;
    return url.toString();
  }

  function buildCheckoutUrl() {
    if (cfg.paymentLink && String(cfg.paymentLink).trim()) {
      var link = String(cfg.paymentLink).trim();
      var u = new URL(link, window.location.origin);
      if (!u.searchParams.has('quantity')) u.searchParams.set('quantity', '1');
      u.searchParams.set('redirect_url', getReturnUrl());
      return u.toString();
    }
    var productId = String(cfg.productId || '').trim();
    if (!productId || productId.indexOf('YOUR_') === 0) return null;
    var buy = new URL(CHECKOUT_BUY_BASE + encodeURIComponent(productId));
    buy.searchParams.set('quantity', '1');
    buy.searchParams.set('redirect_url', getReturnUrl());
    return buy.toString();
  }

  function openCheckout(event) {
    if (event) event.preventDefault();
    var url = buildCheckoutUrl();
    if (!url) {
      window.alert(t('pricing.configMissing', null, '尚未配置 Live 商品。请在 landing/js/dodo-config.js 填写 productId 或 paymentLink。'));
      return;
    }
    window.location.href = url;
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function showSuccessPanel(licenseKey, email) {
    var panel = document.getElementById('buySuccess');
    var keyEl = document.getElementById('buyLicenseKey');
    var emailEl = document.getElementById('buySuccessEmail');
    if (!panel || !keyEl) return;
    keyEl.textContent = licenseKey;
    if (emailEl) {
      emailEl.textContent = email
        ? t('pricing.successDescWithEmail', { email: email }, '收据已发送至 ' + email)
        : t('pricing.successDesc', null, '请同时查收邮箱中的 License Key');
    }
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function copyLicenseKey() {
    var keyEl = document.getElementById('buyLicenseKey');
    var key = keyEl ? keyEl.textContent.trim() : '';
    if (!key) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(key).then(function () {
        var btn = document.getElementById('copyLicenseBtn');
        if (btn) {
          var old = btn.textContent;
          btn.textContent = t('pricing.copied', null, '已复制');
          setTimeout(function () { btn.textContent = old; }, 1600);
        }
      });
    }
  }

  function wireBuyButtons() {
    document.querySelectorAll('[data-dodo-checkout]').forEach(function (el) {
      el.addEventListener('click', openCheckout);
    });
    var copyBtn = document.getElementById('copyLicenseBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyLicenseKey);

    var priceEls = document.querySelectorAll('[data-dodo-price]');
    priceEls.forEach(function (el) {
      if (cfg.priceLabel) el.textContent = cfg.priceLabel;
    });
    var noteEls = document.querySelectorAll('[data-dodo-price-note]');
    noteEls.forEach(function (el) {
      if (cfg.priceNote && String(cfg.priceNote).trim()) {
        el.textContent = cfg.priceNote;
      }
    });
  }

  function handleReturnFromCheckout() {
    var status = qs('status');
    var licenseKey = qs('license_key');
    var email = qs('email');
    var paymentId = qs('payment_id');

    if (status === 'succeeded' || licenseKey || paymentId) {
      if (licenseKey) showSuccessPanel(licenseKey, email);
      else {
        var panel = document.getElementById('buySuccess');
        var keyEl = document.getElementById('buyLicenseKey');
        var emailEl = document.getElementById('buySuccessEmail');
        if (panel && keyEl) {
          keyEl.textContent = t('pricing.successPaidNoKey', null, '请查收邮箱中的 License Key');
          if (emailEl) {
            emailEl.textContent = email
              ? t('pricing.successPaidNoKeyWithEmail', { email: email }, '支付成功，收据已发送至 ' + email)
              : t('pricing.successPaidNoKey', null, '支付成功。License Key 已发送到你的邮箱。');
          }
          panel.hidden = false;
        }
      }
      // Clean query params but keep #buy
      if (window.history && window.history.replaceState) {
        var clean = window.location.pathname + '#' + (cfg.returnHash || 'buy');
        window.history.replaceState({}, document.title, clean);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireBuyButtons();
    handleReturnFromCheckout();
  });

  window.TinyNoteCheckout = {
    open: openCheckout,
    buildCheckoutUrl: buildCheckoutUrl,
  };
})();

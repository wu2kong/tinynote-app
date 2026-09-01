import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../constants/app.dart';
import '../constants/app_store_iap.dart';
import '../l10n/l10n.dart';
import '../services/app_store_iap.dart';
import '../services/license_store.dart';
import '../theme/app_colors.dart';
import '../utils/open_url.dart';
import 'app_toast.dart';

class AppStorePurchaseControls extends StatelessWidget {
  const AppStorePurchaseControls({
    super.key,
    this.onSuccess,
    this.showLegal = true,
  });

  final VoidCallback? onSuccess;
  final bool showLegal;

  Future<void> _purchase(BuildContext context, String productId) async {
    final license = context.license;
    final s = context.s;
    final ok = await license.purchase(productId);
    if (!context.mounted) return;
    if (ok) {
      showAppToast(context, s.proStorePurchaseComplete);
      onSuccess?.call();
    }
  }

  Future<void> _restore(BuildContext context) async {
    final license = context.license;
    final s = context.s;
    final ok = await license.restore();
    if (!context.mounted) return;
    showAppToast(
      context,
      ok ? s.proStoreRestoreComplete : s.proStoreRestoreEmpty,
    );
    if (ok) onSuccess?.call();
  }

  Future<void> _openLink(BuildContext context, String url) async {
    final opened = await openExternalUrl(url);
    if (!opened && context.mounted) {
      showAppToast(context, context.s.openProjectFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final license = context.license;
    final busy = license.busy;

    if (!isAppStoreIapAvailable) {
      return Text(
        s.proPurchaseUnavailable,
        style: TextStyle(fontSize: 13, height: 1.4, color: colors.body),
      );
    }

    if (license.isPro) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.crown, size: 16, color: colors.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  s.proStoreActive,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: colors.title,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _ActionButton(
            label: s.proStoreRestore,
            icon: LucideIcons.rotateCcw,
            busy: busy,
            onPressed: busy ? null : () => _restore(context),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          s.proStoreHint,
          style: TextStyle(fontSize: 13, height: 1.4, color: colors.body),
        ),
        const SizedBox(height: 10),
        _ActionButton(
          label: s.fill(s.proStoreMonthly, {
            'price': license.priceFor(appStoreMonthlyProductId),
          }),
          icon: LucideIcons.shoppingBag,
          primary: true,
          busy: busy,
          onPressed:
              busy ? null : () => _purchase(context, appStoreMonthlyProductId),
        ),
        const SizedBox(height: 8),
        _ActionButton(
          label: s.fill(s.proStoreYearly, {
            'price': license.priceFor(appStoreYearlyProductId),
          }),
          icon: LucideIcons.shoppingBag,
          primary: true,
          busy: busy,
          onPressed:
              busy ? null : () => _purchase(context, appStoreYearlyProductId),
        ),
        const SizedBox(height: 8),
        _ActionButton(
          label: s.fill(s.proStoreLifetime, {
            'price': license.priceFor(appStoreLifetimeProductId),
          }),
          icon: LucideIcons.crown,
          busy: busy,
          onPressed:
              busy ? null : () => _purchase(context, appStoreLifetimeProductId),
        ),
        const SizedBox(height: 8),
        _ActionButton(
          label: s.proStoreRestore,
          icon: LucideIcons.rotateCcw,
          busy: busy,
          onPressed: busy ? null : () => _restore(context),
        ),
        if (license.error != null) ...[
          const SizedBox(height: 8),
          Text(
            license.error!,
            style: TextStyle(fontSize: 12, height: 1.35, color: colors.danger),
          ),
        ],
        if (showLegal) ...[
          const SizedBox(height: 10),
          Text(
            s.proStoreLegal,
            style: TextStyle(fontSize: 11, height: 1.4, color: colors.muted),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              _TextLink(
                label: s.proStorePrivacy,
                onTap: () => _openLink(context, privacyUrl),
              ),
              _TextLink(
                label: s.proStoreTerms,
                onTap: () => _openLink(context, termsUrl),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.busy,
    this.primary = false,
    this.onPressed,
  });

  final String label;
  final IconData icon;
  final bool busy;
  final bool primary;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: primary ? colors.accent : colors.hover,
          foregroundColor: primary ? Colors.white : colors.title,
          disabledBackgroundColor: colors.hover,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        icon:
            busy
                ? SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: primary ? Colors.white : colors.accent,
                  ),
                )
                : Icon(icon, size: 16),
        label: Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

class _TextLink extends StatelessWidget {
  const _TextLink({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: colors.accent,
        ),
      ),
    );
  }
}

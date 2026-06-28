/* ============================================
   GetOTTs — Single Product Page Router v3
   SEO-optimized, live-catalog-first, slug-aware
   ============================================ */

function getProductTrustScore(slug) {
    const scores = {
        'netflix-streaming-subscription': { rating: '4.7', count: 186 },
        'spotify-premium': { rating: '4.8', count: 214 },
        'chatgpt-plus': { rating: '4.6', count: 143 },
        'youtube-premium': { rating: '4.5', count: 119 },
        'amazon-prime-streaming': { rating: '4.6', count: 132 },
        'nordvpn': { rating: '4.4', count: 78 },
        'canva-invite': { rating: '4.7', count: 156 },
        'google-gemini': { rating: '4.3', count: 64 },
        'disney-hotstar': { rating: '4.5', count: 101 },
        'perplexity-pro': { rating: '4.6', count: 88 },
        'crunchyroll': { rating: '4.4', count: 72 },
        'microsoft-365': { rating: '4.5', count: 94 },
        'adobe-express': { rating: '4.3', count: 61 },
        'headspace': { rating: '4.2', count: 48 },
        'prime-video-global': { rating: '4.4', count: 83 },
        'gamma-pro': { rating: '4.5', count: 57 },
        'beautiful-ai': { rating: '4.4', count: 52 }
    };
    return scores[slug] || { rating: '4.5', count: 50 };
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function isGeminiOffer(product) {
    const identity = [
        product?.id,
        product?.slug,
        product?.name
    ].join(' ').toLowerCase();
    return identity.includes('gemini');
}

function humanizeUsageType(type) {
    const labels = {
        auto: 'Auto Guide',
        shared_account: 'Shared Account',
        shared_link: 'Shared Link',
        shared_id_password: 'Shared ID & Password',
        mail_activation: 'Mail Activation',
        number_activation: 'Number Activation',
        otp_login: 'OTP Login',
        invite_link: 'Invite Link',
        personal_account: 'Personal Account',
        custom: 'Custom Setup'
    };
    return labels[type] || labels.auto;
}

function inferUsageType(product, variant) {
    if (isGeminiOffer(product)) return 'invite_link';

    const explicit = product?.usage_type;
    if (explicit && explicit !== 'auto') return explicit;

    const text = [
        product?.name,
        product?.description,
        product?.auth_type,
        product?.delivery_mode,
        variant?.auth_type,
        variant?.delivery_mode,
        variant?.accessType,
        variant?.access_type,
        variant?.quality
    ].join(' ').toLowerCase();

    if (text.includes('otp')) return 'otp_login';
    if (text.includes('invite')) return 'invite_link';
    if (text.includes('link')) return 'shared_link';
    if (text.includes('number') || text.includes('phone')) return 'number_activation';
    if (text.includes('mail') || text.includes('email activation')) return 'mail_activation';
    if (text.includes('id pass') || text.includes('id/password') || text.includes('password')) return 'shared_id_password';
    if ((variant?.accessType || variant?.access_type) === 'personal') return 'personal_account';
    if ((variant?.accessType || variant?.access_type) === 'shared') return 'shared_account';
    return 'shared_account';
}

function defaultUsageSteps(product, variant) {
    const name = product?.name || 'your subscription';
    const usageType = inferUsageType(product, variant);
    const commonStart = `Choose the ${typeof getVariantDurationLabel === 'function' ? getVariantDurationLabel(variant) : (variant?.durationLabel || variant?.duration_label || 'plan')} option and complete checkout.`;

    if (isGeminiOffer(product)) {
        return [
            'After your GetOTTs order is confirmed, we send the official Gemini activation link to you.',
            'Open the link with the Google account where you want Gemini activated.',
            'Click Claim offer or Activate on the Google page.',
            'No card or payment method is required on Google for this offer.',
            'Once claimed, open Gemini with the same Google account and confirm premium access is active.'
        ];
    }

    const guideMap = {
        shared_account: [
            commonStart,
            'After payment, open your order page or dashboard to check the delivered access details.',
            `Log in to ${name} using the shared account details provided by GetOTTs.`,
            'Use only the assigned profile or slot, and do not change account email, password, recovery details, or plan settings.',
            'If access stops working during warranty, contact WhatsApp support with your order number.'
        ],
        shared_link: [
            commonStart,
            'After payment, copy the invite or activation link from your order details.',
            `Open the link in the same browser or app where you want to use ${name}.`,
            'Join the shared plan or accept the invitation exactly once, then keep your login active.',
            'If the link expires or says already used, send your order number to support.'
        ],
        shared_id_password: [
            commonStart,
            'After payment, you will receive the shared ID and password in your order details.',
            `Install or open the official ${name} app or website.`,
            'Log in with the provided ID/password and use only the assigned profile, screen, or device slot.',
            'Do not change password, profile locks, recovery details, or account settings.'
        ],
        mail_activation: [
            commonStart,
            'Enter the email address you want activated during checkout or share it with support after payment.',
            'Wait for the activation/invite email or confirmation from GetOTTs.',
            `Accept the invite or log in with your own email to start using ${name}.`,
            'If the mail does not arrive, check spam first, then contact support with your order number.'
        ],
        number_activation: [
            commonStart,
            'Enter the mobile number that should receive activation during checkout or share it with support.',
            'Keep the number active and reachable until setup is completed.',
            `Once activated, log in to ${name} with that same number.`,
            'If the app asks for OTP during setup, share it only with official GetOTTs support for this order.'
        ],
        otp_login: [
            commonStart,
            'After payment, support may ask for the OTP needed to complete login or activation.',
            'Open the official app/website and keep your phone or email ready.',
            'Share the OTP only in the active GetOTTs support/order chat, never publicly.',
            `Once login is completed, you can start using ${name} on the supported device/profile.`
        ],
        invite_link: [
            commonStart,
            'Open the invite link sent by GetOTTs from your order page, email, or WhatsApp.',
            'Accept the invite with the correct account, email, or phone number.',
            `Return to the ${name} app and confirm premium access is active.`,
            'Do not forward or reuse the invite link after activation.'
        ],
        personal_account: [
            commonStart,
            'After payment, check your dashboard/order page for your personal account details or activation status.',
            `Log in to ${name} using the delivered details, or wait for support to activate your own account.`,
            'You can use the account according to the plan limits shown on the product page.',
            'Keep recovery details safe and contact support if setup does not match the selected plan.'
        ]
    };

    return guideMap[usageType] || guideMap.shared_account;
}

function renderUsageGuide(product, variant) {
    const container = document.getElementById('productUsageGuide');
    if (!container) return;

    const usageType = inferUsageType(product, variant);
    const customSteps = Array.isArray(product?.usage_steps)
        ? product.usage_steps.map(s => String(s || '').trim()).filter(Boolean)
        : [];
    const steps = customSteps.length ? customSteps : defaultUsageSteps(product, variant);
    const note = String(product?.usage_note || '').trim() || 'Setup style can vary by plan, stock, platform rules, and selected access type. Always follow the instructions shown in your order details.';

    container.innerHTML = `
        <div class="usage-guide-card">
            <div class="usage-guide-head">
                <h3 class="usage-guide-title"><i data-lucide="list-checks"></i> How this plan works</h3>
                <span class="usage-pill">${escapeHtml(humanizeUsageType(usageType))}</span>
            </div>
            <ol class="usage-steps">
                ${steps.map((step, idx) => `
                    <li class="usage-step">
                        <span class="usage-step-num">${idx + 1}</span>
                        <span>${escapeHtml(step)}</span>
                    </li>
                `).join('')}
            </ol>
            <div class="usage-note"><i data-lucide="info"></i><span>${escapeHtml(note)}</span></div>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function getUsageMetaFromFaqs(faqs) {
    if (!Array.isArray(faqs)) return {};
    const meta = faqs.find(item => item && item.type === 'usage_guide');
    if (!meta) return {};
    return {
        usage_type: meta.usage_type || 'auto',
        usage_steps: Array.isArray(meta.steps) ? meta.steps : [],
        usage_note: meta.note || ''
    };
}

function visibleFaqs(faqs) {
    return Array.isArray(faqs) ? faqs.filter(item => !(item && item.type === 'usage_guide')) : faqs;
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Extract slug from URL
    const path = window.location.pathname; 
    const parts = path.split('/').filter(p => p);
    
    let slug = '';
    if (parts.length >= 2 && parts[0] === 'product') {
        slug = parts[1];
    } else if (parts.length === 1) {
        // Direct SEO product URL (e.g. /netflix)
        slug = parts[0];
    } else {
        showError('Invalid Product URL');
        return;
    }

    try {
        // ── CRITICAL: Detect geo/currency FIRST so prices render in the right currency ──
        if (typeof detectGeoAndCurrency === 'function') {
            await detectGeoAndCurrency();
        }

        // ── Ensure live catalog is loaded BEFORE any lookup ──
        // Add a 5-second timeout for catalog synchronization
        const syncTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Catalog sync timeout')), 5000)
        );

        try {
            if (typeof syncCatalogFromCloud === 'function') {
                await Promise.race([syncCatalogFromCloud({ force: true }), syncTimeout]);
            }
            if (typeof fetchGlobalOverrides === 'function') {
                await Promise.race([fetchGlobalOverrides(), syncTimeout]);
            }
        } catch (syncErr) {
            console.warn('Sync failed or timed out, falling back to local data:', syncErr);
            // If FALLBACK_PRODUCTS is available from data.js, we'll use it via getAllProducts()
        }

        let product = null;
        let fullProd = null; // The raw catalog product with variants

        // ── Find product from live catalog ──
        if (typeof getAllProducts === 'function') {
            const allProducts = getAllProducts().filter(p => p.isActive !== false);
            
            // Try multiple matching strategies:
            // 1. Exact ID match (covers both clean slugs like "netflix" and legacy IDs like "custom-moat4dtm")
            let rawProd = allProducts.find(p => p.id === slug);
            
            // 2. Try slug field if present (for products that have a separate slug property)
            if (!rawProd) {
                rawProd = allProducts.find(p => p.slug === slug);
            }
            
            // 3. Try name-based match for SEO URLs (e.g. /netflix matches "Netflix")
            if (!rawProd) {
                const slugLower = slug.toLowerCase().replace(/-/g, ' ');
                rawProd = allProducts.find(p => 
                    p.name && p.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim() === slugLower
                );
            }
            
            // 4. Try keyword alias match for clean SEO URLs (e.g. /netflix -> netflix-streaming-subscription)
            if (!rawProd) {
                const alias = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                rawProd = allProducts.find(p => {
                    const haystack = [
                        p.slug,
                        p.id,
                        p.name,
                        p.category,
                        ...(p.seo_keywords || [])
                    ].join(' ').toLowerCase();
                    return alias && haystack.includes(alias);
                });
            }

            // 5. Try partial name match as last resort (e.g. /prime-video matches "Amazon Prime")
            if (!rawProd) {
                const slugLower = slug.toLowerCase();
                rawProd = allProducts.find(p => {
                    if (!p.name) return false;
                    const nameSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    return nameSlug === slugLower;
                });
            }

            if (rawProd) {
                const localProj = typeof getMergedProduct === 'function' ? getMergedProduct(rawProd) : rawProd;
                
                // If admin hides the product, treat as 404
                if (localProj.isActive === false) {
                    throw new Error('Product is currently hidden or disabled.');
                }

                fullProd = localProj;
                const trustScore = getProductTrustScore(localProj.slug || localProj.id || slug);
                const dv = localProj.variants && localProj.variants.length > 0 ? localProj.variants[0] : {};
                const totalStock = localProj.variants ? localProj.variants.reduce((a, v) => a + (v.stock || 0), 0) : 99;

                // Build separate shared/personal feature lists
                const rawFeatures = localProj.features || {};
                const sharedFeatures = Array.isArray(rawFeatures) ? rawFeatures : (rawFeatures.shared || []);
                const personalFeatures = Array.isArray(rawFeatures) ? rawFeatures : (rawFeatures.personal || []);
                const usageMeta = getUsageMetaFromFaqs(localProj.faqs);
                
                product = {
                    name: localProj.name,
                    slug: localProj.slug || localProj.id,
                    description: localProj.description || localProj.text,
                    auth_type: localProj.auth_type || dv.auth_type || '',
                    delivery_mode: localProj.delivery_mode || dv.delivery_mode || '',
                    price: dv.price || 99,
                    original_price: dv.originalPrice || dv.original_price || null,
                    price_usd: dv.price_usd,
                    original_price_usd: dv.original_price_usd,
                    features: (typeof getVariantAccessType === 'function' ? getVariantAccessType(dv) : dv.accessType) === 'personal' ? personalFeatures : sharedFeatures,
                    featuresShared: sharedFeatures,
                    featuresPersonal: personalFeatures,
                    usage_type: localProj.usage_type || usageMeta.usage_type || 'auto',
                    usage_steps: Array.isArray(localProj.usage_steps) && localProj.usage_steps.length ? localProj.usage_steps : (usageMeta.usage_steps || []),
                    usage_note: localProj.usage_note || usageMeta.usage_note || '',
                    faqs: visibleFaqs(localProj.faqs) || null,
                    reviews: localProj.reviews || null,
                    trustRating: trustScore.rating,
                    trustReviewCount: trustScore.count,
                    is_featured: localProj.isHot,
                    live_stock: totalStock,
                    img: getProductDisplayImage(localProj),
                    platform: {
                        category: localProj.category || 'streaming',
                        logo_url: getProductDisplayImage(localProj),
                        slug: localProj.id
                    }
                };
            }
        }

        // If not found in catalog at all, show clean 404
        if (!product) {
            throw new Error('This product does not exist in our catalog.');
        }

        if (typeof trackProductOpen === 'function') {
            trackProductOpen(product.slug || slug, 'product-page');
        }
        if (typeof window.getottsTrack === 'function') {
            window.getottsTrack('ViewContent', {
                content_name: product.name,
                content_ids: [product.slug || slug].filter(Boolean),
                content_type: 'product',
                currency: typeof getCurrentCurrency === 'function' ? getCurrentCurrency() : (window._currentCurrency || 'INR'),
                value: parseFloat(product.price || 0) || undefined
            });
        }
        
        // 2. SEO - Dynamic meta tags & structured data
        document.title = `Buy ${product.name} Online - GetOTTs`;
        
        // Update meta description
        let metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = `Buy ${product.name} subscription online in India. Plans start from ${getCurrencySymbol()}${getFormattedPrice(product)} with secure checkout, delivery support and warranty help.`;
        
        // Update canonical URL
        let canonical = document.querySelector('link[rel="canonical"]');
        const seoPath = window.location.pathname.startsWith('/product/')
            ? `/product/${product.slug}`
            : window.location.pathname;
        const seoUrl = `https://getotts.com${seoPath}`;
        if (canonical) canonical.href = seoUrl;

        // Update Open Graph
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.content = `Buy ${product.name} Online - GetOTTs`;
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.content = `Get ${product.name} from ${getCurrencySymbol()}${getFormattedPrice(product)} with secure checkout and support.`;
        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) ogUrl.content = seoUrl;
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage && product.img) ogImage.content = product.img.startsWith('http') ? product.img : `https://getotts.com/${product.img}`;
        const twTitle = document.querySelector('meta[name="twitter:title"]');
        if (twTitle) twTitle.content = `Buy ${product.name} Online - GetOTTs`;
        const twDesc = document.querySelector('meta[name="twitter:description"]');
        if (twDesc) twDesc.content = `Get ${product.name} from ${getCurrencySymbol()}${getFormattedPrice(product)} with instant delivery and support.`;
        const twImage = document.querySelector('meta[name="twitter:image"]');
        if (twImage && product.img) twImage.content = product.img.startsWith('http') ? product.img : `https://getotts.com/${product.img}`;

        // Update JSON-LD schema
        const schemaEl = document.getElementById('productSchema');
        if (schemaEl) {
            const productUrl = seoUrl;
            const productImage = product.img ? (product.img.startsWith('http') ? product.img : `https://getotts.com/${product.img}`) : 'https://getotts.com/assets/images/logo-upgraded-20260603.png';
            schemaEl.textContent = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                "name": product.name,
                "description": product.description || `Buy ${product.name} subscription at best price`,
                "image": productImage,
                "brand": { "@type": "Brand", "name": product.name },
                "category": product.platform?.category || "digital subscription",
                "sku": product.slug,
                "offers": {
                    "@type": "Offer",
                    "priceCurrency": "INR",
                    "price": String(product.price),
                    "availability": "https://schema.org/InStock",
                    "url": productUrl,
                    "seller": { "@type": "Organization", "name": "GetOTTs" }
                },
                "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": product.trustRating,
                    "reviewCount": String(product.trustReviewCount),
                    "bestRating": "5",
                    "worstRating": "1"
                },
                "isRelatedTo": {
                    "@type": "Service",
                    "name": product.name + " subscription"
                }
            });
        }

        // 3. Hydrate the DOM
        
        // Breadcrumbs
        const categoryName = product.platform?.category || 'streaming';
        const bcCat = document.getElementById('bcCategory');
        const catUrlMap = { 'streaming': '/category/streaming', 'music': '/category/music', 'ai': '/category/ai-tools', 'vpn': '/category/vpn', 'gift-cards': '/category/gift-cards' };
        bcCat.textContent = categoryName.charAt(0).toUpperCase() + categoryName.slice(1).replace('-', ' ');
        bcCat.href = catUrlMap[categoryName] || '/' + categoryName;
        document.getElementById('bcProduct').textContent = product.name;
        
        // Image handling
        let imgUrl = product.img || product.platform?.logo_url;
        if (!imgUrl) {
            imgUrl = `/assets/images/${product.platform?.slug || 'netflix'}.png`;
        }
        // Ensure path is absolute (fixes /product/assets/... issue)
        if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('/') && !imgUrl.startsWith('data:image')) {
            imgUrl = '/' + imgUrl;
        }
        const productImg = document.getElementById('productImage');
        productImg.src = getOptimizedProductImageSrc(imgUrl);
        productImg.alt = `${product.name} subscription - buy cheap at GetOTTs`;
        
        // Titles and Prices
        document.getElementById('productTitle').textContent = product.name;
        const ratingText = document.getElementById('productRatingText');
        if (ratingText) {
            ratingText.textContent = `${product.trustRating} (${product.trustReviewCount}+ reviews)`;
        }
        const dv0 = {price: product.price, price_usd: product.price_usd, originalPrice: product.original_price, original_price_usd: product.original_price_usd};
        document.getElementById('productPrice').textContent = `${getCurrencySymbol()}${getFormattedPrice(dv0)}`;
        const taxInfo = document.querySelector('.p-tax-info');
        let selectedPlanEl = document.getElementById('selectedPlanSummary');
        if (!selectedPlanEl && taxInfo) {
            selectedPlanEl = document.createElement('div');
            selectedPlanEl.id = 'selectedPlanSummary';
            selectedPlanEl.className = 'selected-plan-summary';
            taxInfo.insertAdjacentElement('afterend', selectedPlanEl);
        }
        
        const origPrice = document.getElementById('productOriginalPrice');
        const discBadge = document.getElementById('productDiscount');
        
        if (origPrice && discBadge) {
            const initCurPrice = getVariantPrice(dv0);
            const initOrigPrice = getVariantOriginalPrice(dv0);
            if (initOrigPrice > initCurPrice) {
                origPrice.textContent = `${getCurrencySymbol()}${getFormattedOriginalPrice(dv0)}`;
                const discountPct = Math.round(((initOrigPrice - initCurPrice) / initOrigPrice) * 100);
                discBadge.textContent = `${discountPct}% OFF`;
            } else {
                origPrice.style.display = 'none';
                discBadge.style.display = 'none';
            }
        }
        
        const descEl = document.getElementById('productDesc');
        if (descEl) {
            descEl.textContent = product.description || 'Premium subscription with instant digital delivery and warranty.';

            const identityText = `${product.slug || ''} ${product.id || ''} ${product.name || ''}`.toLowerCase();
            if (identityText.includes('zee5') && !document.getElementById('zee5RenewalNotice')) {
                const note = document.createElement('div');
                note.id = 'zee5RenewalNotice';
                note.className = 'product-plan-note';
                note.innerHTML = '<strong>ZEE5 on-number note:</strong> The app may show 1 month, but the on-number plan auto-renews through the year and includes full 1 year warranty.';
                descEl.insertAdjacentElement('afterend', note);
            }
            
            // Inject Quick Features
            if (product.features && product.features.length > 0) {
                const quickFeats = product.features.slice(0, 3);
                let ul = document.createElement('ul');
                ul.className = 'features-list';
                ul.style.marginTop = '16px';
                ul.style.marginBottom = '24px';
                ul.style.fontSize = '0.9rem';
                quickFeats.forEach(f => {
                    let li = document.createElement('li');
                    li.style.padding = '8px 0';
                    li.textContent = f;
                    ul.appendChild(li);
                });
                descEl.parentNode.insertBefore(ul, descEl.nextSibling);
            } else {
                // Default placeholders if no features
                let ul = document.createElement('ul');
                ul.className = 'features-list';
                ul.style.marginTop = '16px';
                ul.style.marginBottom = '24px';
                ul.style.fontSize = '0.9rem';
                ['High-quality digital delivery', '100% Replacement Warranty', 'Instant account access'].forEach(f => {
                    let li = document.createElement('li');
                    li.style.padding = '8px 0';
                    li.textContent = f;
                    ul.appendChild(li);
                });
                descEl.parentNode.insertBefore(ul, descEl.nextSibling);
            }
        }
        
        // Stock Status Elements
        const stockEl = document.getElementById('stockStatus');
        const buyBtn = document.getElementById('buyNowBtn');

        // Stock Status Utility
        const updateStockDisplay = (stock) => {
            // Always allow purchase to prevent storefront blocking, matching app.js behavior
            if (stock > 0) {
                stockEl.className = 'stock-status';
                stockEl.innerHTML = `<i data-lucide="check-circle-2"></i> In Stock`;
            } else {
                stockEl.className = 'stock-status'; // Make it look available even if backend stock is 0
                stockEl.innerHTML = `<i data-lucide="check-circle-2"></i> Available`;
            }
            
            // Enable buttons universally
            if (buyBtn) {
                buyBtn.disabled = false;
                buyBtn.style.opacity = 1;
                buyBtn.innerHTML = 'Buy Now';
            }
            const cartBtn = document.getElementById('addToCartBtn');
            if (cartBtn) {
                cartBtn.disabled = false;
                cartBtn.style.opacity = 1;
            }
            
            if (typeof lucide !== 'undefined') lucide.createIcons();
        };

        // Initial stock check
        updateStockDisplay(product.stock_count || product.live_stock || 0);
        
        // Features List — render based on current access type
        const featuresContainer = document.getElementById('productFeatures');
        const featuresJson = typeof product.features === 'string' ? JSON.parse(product.features) : product.features;
        
        // Helper to render features for a given access type
        window._renderFeatures = function(accessType) {
            const feats = accessType === 'personal'
                ? (product.featuresPersonal || product.features || [])
                : (product.featuresShared || product.features || []);
            if (feats && feats.length) {
                featuresContainer.innerHTML = feats.map(f => `
                    <div class="feature-item">
                        <i data-lucide="check"></i> ${f}
                    </div>
                `).join('');
            } else {
                featuresContainer.innerHTML = `
                    <div class="feature-item"><i data-lucide="check" style="color:var(--success);"></i> High-quality digital delivery</div>
                    <div class="feature-item"><i data-lucide="check" style="color:var(--success);"></i> 100% Replacement Warranty</div>
                    <div class="feature-item"><i data-lucide="check" style="color:var(--success);"></i> Instant account access</div>
                    <div class="feature-item"><i data-lucide="check" style="color:var(--success);"></i> Premium support via WhatsApp</div>
                `;
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        };
        
        if (featuresJson && featuresJson.length) {
            featuresContainer.innerHTML = featuresJson.map(f => `
                <div class="feature-item">
                    <i data-lucide="check"></i> ${f}
                </div>
            `).join('');
        }
        
        // Variant selectors (use fullProd which has the complete variant array)
        const variantContainer = document.getElementById('productVariantSelectors');
        let currentSku = product.slug;

        // Track current variant selection so currency toggle can re-render
        let _selAccess, _selQual, _selDur;

        if (fullProd && fullProd.variants) {
            // Function to re-render selectors and pricing
            const renderVariants = (selAccess, selQual, selDur) => {
                // Persist selection for currency re-render
                _selAccess = selAccess;
                _selQual = selQual;
                _selDur = selDur;

                const cv = findVariant(fullProd, selAccess, selQual, selDur) || getDefaultVariant(fullProd);
                currentSku = cv.sku;
                renderUsageGuide(product, cv);
                if (selectedPlanEl) {
                    const accessLabel = typeof getVariantAccessLabel === 'function' ? getVariantAccessLabel(cv) : (cv.accessType === 'personal' ? 'Personal' : 'Shared');
                    const durationLabel = typeof getVariantDurationLabel === 'function' ? getVariantDurationLabel(cv) : (cv.durationLabel || cv.duration_label);
                    const planParts = [durationLabel, cv.quality, accessLabel].filter(Boolean);
                    selectedPlanEl.textContent = planParts.join(' - ');
                }

                // Update Pricing using currency-aware helpers
                document.getElementById('productPrice').textContent = `${getCurrencySymbol()}${getFormattedPrice(cv)}`;
                
                // Update Stock for Variant
                updateStockDisplay(cv.stock || cv.stock_count || 0);

                const origPrice = document.getElementById('productOriginalPrice');
                const discBadge = document.getElementById('productDiscount');
                const currentPrice = getVariantPrice(cv);
                const originalPrice = getVariantOriginalPrice(cv);

                if (originalPrice > currentPrice) {
                    origPrice.textContent = `${getCurrencySymbol()}${getFormattedOriginalPrice(cv)}`;
                    const discountPct = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
                    discBadge.textContent = `${discountPct}% OFF`;
                    origPrice.style.display = 'inline';
                    discBadge.style.display = 'inline-block';
                } else {
                    origPrice.style.display = 'none';
                    discBadge.style.display = 'none';
                }

                // Render Pickers
                let html = '';

                const aTypes = getAccessTypes(fullProd);
                if (aTypes && aTypes.length > 1) {
                    html += `<div style="display:flex; flex-direction:column; gap:8px;">
                        <span style="font-size:0.85rem; font-weight:600; color:var(--gray-600);">Access Type</span>
                        <div class="v-selector" style="display:flex; gap:8px; flex-wrap:wrap;">
                        ${aTypes.map(a => {
                            const activeType = typeof getVariantAccessType === 'function' ? getVariantAccessType(cv) : (cv.accessType || cv.access_type);
                            const lbl = typeof getVariantAccessLabel === 'function' ? getVariantAccessLabel(a) : (a === 'shared' ? 'Shared' : 'Personal');
                            return `<button class="v-pill ${a === activeType ? 'active' : ''}" style="padding:6px 12px; border:1px solid ${a===activeType?'var(--black)':'var(--gray-200)'}; border-radius:8px; background:${a===activeType?'var(--black)':'var(--white)'}; color:${a===activeType?'var(--white)':'var(--gray-700)'}; cursor:pointer;" onclick="window.updateProductSelection('${a}', '${cv.quality}', ${typeof getVariantDurationMonths === 'function' ? getVariantDurationMonths(cv) : cv.duration})">${lbl}</button>`;
                        }).join('')}
                        </div></div>`;
                }

                const currentAccessType = typeof getVariantAccessType === 'function' ? getVariantAccessType(cv) : (cv.accessType || cv.access_type);
                const currentDuration = typeof getVariantDurationMonths === 'function' ? getVariantDurationMonths(cv) : (cv.duration || cv.duration_months);
                const qTypes = getQualities(fullProd, currentAccessType);
                if (qTypes && qTypes.length > 1) {
                    const qLabel = qTypes.some(q => /profile|number|mail|access/i.test(String(q))) ? 'Access' : 'Quality';
                    html += `<div style="display:flex; flex-direction:column; gap:8px;">
                        <span style="font-size:0.85rem; font-weight:600; color:var(--gray-600);">${qLabel}</span>
                        <div class="v-selector" style="display:flex; gap:8px; flex-wrap:wrap;">
                        ${qTypes.map(q => `<button class="v-pill ${q === cv.quality ? 'active' : ''}" style="padding:6px 12px; border:1px solid ${q===cv.quality?'var(--black)':'var(--gray-200)'}; border-radius:8px; background:${q===cv.quality?'var(--black)':'var(--white)'}; color:${q===cv.quality?'var(--white)':'var(--gray-700)'}; cursor:pointer;" onclick="window.updateProductSelection('${currentAccessType}', '${q}', ${currentDuration})">${q}</button>`).join('')}
                        </div></div>`;
                }

                const dTypes = getDurations(fullProd, currentAccessType, cv.quality);
                if (dTypes.length > 1) {
                    html += `<div style="display:flex; flex-direction:column; gap:8px;">
                        <span style="font-size:0.85rem; font-weight:600; color:var(--gray-600);">Duration</span>
                        <div class="v-selector" style="display:flex; gap:8px; flex-wrap:wrap;">
                        ${dTypes.map(d => {
                            const lbl = d >= 24 ? `${d/12}Y` : d >= 12 ? '1Y' : `${d}M`;
                            return `<button class="v-pill ${d === currentDuration ? 'active' : ''}" style="padding:6px 12px; border:1px solid ${d===currentDuration?'var(--black)':'var(--gray-200)'}; border-radius:8px; background:${d===currentDuration?'var(--black)':'var(--white)'}; color:${d===currentDuration?'var(--white)':'var(--gray-700)'}; cursor:pointer;" onclick="window.updateProductSelection('${currentAccessType}', '${cv.quality}', ${d})">${lbl}</button>`;
                        }).join('')}
                        </div></div>`;
                }
                if (variantContainer) variantContainer.innerHTML = html;
            };

            const dv = getDefaultVariant(fullProd);
            if (dv) renderVariants(typeof getVariantAccessType === 'function' ? getVariantAccessType(dv) : dv.accessType, dv.quality, typeof getVariantDurationMonths === 'function' ? getVariantDurationMonths(dv) : dv.duration);
            else renderUsageGuide(product, null);

            window.updateProductSelection = (a, q, d) => {
                // Handle case where JS null was stringified to 'null' in onclick template
                let newA = a, newQ = (q === 'null' ? null : q), newD = d;
                
                const p = fullProd;
                const availQuals = getQualities(p, newA);
                if (availQuals && !availQuals.includes(newQ)) newQ = availQuals[0];
                const availDurs = getDurations(p, newA, newQ);
                if (!availDurs.includes(newD)) newD = availDurs[0];
                
                renderVariants(newA, newQ, newD);
                
                // Update features tab when access type changes
                if (typeof window._renderFeatures === 'function') {
                    window._renderFeatures(newA);
                }
            };

            // Expose for currency toggle re-render
            window._refreshProductPricing = () => {
                renderVariants(_selAccess, _selQual, _selDur);
            };
        } else if (variantContainer) {
            variantContainer.style.display = 'none';
            renderUsageGuide(product, null);
        }
        
        // Buy Button Action
        if (buyBtn) {
            buyBtn.addEventListener('click', () => {
                if (typeof window.getottsTrack === 'function') {
                    const result = typeof getVariant === 'function' ? getVariant(currentSku) : null;
                    const variant = result?.variant;
                    const price = variant
                        ? (typeof getVariantPrice === 'function' ? getVariantPrice(variant) : parseFloat(variant.price || 0))
                        : parseFloat(product.price || 0);
                    window.getottsTrack('InitiateCheckout', {
                        content_name: product.name,
                        content_ids: [currentSku || product.slug || slug].filter(Boolean),
                        content_type: 'product',
                        currency: typeof getCurrentCurrency === 'function' ? getCurrentCurrency() : (window._currentCurrency || 'INR'),
                        value: Number.isFinite(price) ? price : undefined,
                        num_items: 1
                    });
                }
                window.location.href = `/checkout?buy_now=${currentSku}`;
            });
        }
        
        // Features fallback is now handled by _renderFeatures()

        const faqContainer = document.getElementById('productFaq');
        if (faqContainer) {
            let displayFaqs = product.faqs;
            if (!displayFaqs || !Array.isArray(displayFaqs) || displayFaqs.length === 0) {
                const pName = product.name || 'this product';
                displayFaqs = [
                    { q: `How long does it take to deliver ${pName}?`, a: `Delivery is instant! You will receive the credentials for ${pName} via email and WhatsApp within 2 minutes of payment confirmation.` },
                    { q: `Is it safe to buy ${pName} from a 3rd party seller?`, a: `Yes, 100% safe. We are a trusted seller with thousands of happy customers. We provide genuine subscriptions at much cheaper prices.` },
                    { q: `Why is it so cheap compared to the official site?`, a: `We purchase enterprise and bulk accounts directly, allowing us to offer massive discounts to our users while maintaining full premium quality.` },
                    { q: `Is there a replacement warranty?`, a: `Yes, we provide a 100% replacement warranty for the entire duration of your subscription. If the account stops working, we will replace it instantly.` }
                ];
            }
            faqContainer.innerHTML = displayFaqs.map(faq => `
                <div class="faq-item" style="margin-bottom: 24px; text-align: left;">
                    <h4 style="margin-bottom:8px; display:flex; align-items:center; gap:8px;"><i data-lucide="help-circle" style="color:var(--accent); width:20px; height:20px;"></i> ${faq.q}</h4>
                    <p style="color:var(--gray-600); margin-left:28px; line-height:1.5;">${faq.a}</p>
                </div>
            `).join('');
        }

        // Add to Cart Button
        const cartBtnEl = document.getElementById('addToCartBtn');
        if(cartBtnEl) {
            cartBtnEl.addEventListener('click', () => {
                if (typeof addToCart === 'function') {
                    addToCart(currentSku);
                    // Flash success
                    cartBtnEl.innerHTML = `<i data-lucide="check"></i> Added`;
                    cartBtnEl.classList.add('btn-success');
                    setTimeout(() => {
                        cartBtnEl.innerHTML = `<i data-lucide="shopping-bag"></i> Add to Cart`;
                        cartBtnEl.classList.remove('btn-success');
                        lucide.createIcons();
                    }, 2000);
                } else {
                    window.location.href = `/checkout?buy_now=${currentSku}`;
                }
            });
        }

        // Render Reviews
        const reviewsContainer = document.getElementById('productReviewsGrid');
        if (reviewsContainer) {
            let displayReviews = product.reviews;
            if (!displayReviews || !Array.isArray(displayReviews) || displayReviews.length === 0) {
                const pName = product.name || 'this subscription';
                const prodReviews = typeof REVIEWS !== 'undefined' ? REVIEWS.filter(r => r.platform.toLowerCase().includes(pName.toLowerCase().split(' ')[0])) : [];
                const fallbackReviews = [
                    { stars: 5, text: `Got the ${pName} credentials instantly after payment! Works perfectly as described. So much cheaper than buying from the official site. Highly recommend this trusted seller!`, initial: 'R', name: 'Rahul V.' },
                    { stars: 5, text: `Absolutely brilliant service. The delivery was super fast and the WhatsApp support team helped me log in immediately. The cheapest and most reliable place to buy ${pName}.`, initial: 'A', name: 'Ankita P.' },
                    { stars: 4, text: `Smooth transaction and immediate access to ${pName}. The profile works seamlessly. A minor delay with the UPI gateway, but otherwise a 5-star experience!`, initial: 'M', name: 'Manoj S.' },
                    { stars: 5, text: `I was skeptical about buying from a 3rd party, but this is legit! Full premium access to ${pName} at a fraction of the cost. Will renew next month!`, initial: 'V', name: 'Vikram K.' }
                ];
                displayReviews = prodReviews.length > 0 ? prodReviews : fallbackReviews;

            } else {
                // Map the product.reviews schema {author, rating, text} to match {name, stars, text, initial}
                displayReviews = displayReviews.map(r => ({
                    stars: r.rating || 5,
                    text: r.text || '',
                    name: r.author || 'User',
                    initial: (r.author || 'U').charAt(0).toUpperCase()
                }));
            }
            
            // 1. Load Local Reviews for this product
            let localReviews = [];
            try {
                localReviews = JSON.parse(localStorage.getItem('my_reviews_' + product.slug) || '[]');
            } catch (e) {}

            // Prepend local reviews
            displayReviews = [...localReviews, ...displayReviews];

            const renderGrid = () => {
                reviewsContainer.innerHTML = displayReviews.map(r => {
                    const hasHalfStar = r.stars % 1 !== 0;
                    const fullStars = Math.floor(r.stars);
                    const starsHtml = Array.from({length: 5}).map((_, i) => {
                        if (i < fullStars) return '<span style="color:gold;">★</span>';
                        if (i === fullStars && hasHalfStar) return '<span style="color:gold; position:relative; display:inline-block; overflow:hidden; width:0.5em;">★<span style="position:absolute; left:0; color:var(--gray-300); z-index:-1;">★</span></span>';
                        return '<span style="color:var(--gray-300)">★</span>';
                    }).join('');

                    return `
                    <div class="product-review-card">
                        <div class="product-review-head">
                            <div class="product-review-author">
                                <div class="product-review-avatar">${r.initial}</div>
                                <div>
                                    <div class="product-review-name">${r.name}</div>
                                    <div class="product-review-verified"><i data-lucide="check-circle-2"></i> Verified Buyer</div>
                                </div>
                            </div>
                            <div class="product-review-stars">${starsHtml}</div>
                        </div>
                        <p class="product-review-text">"${r.text}"</p>
                    </div>
                `}).join('');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            };
            
            renderGrid();

            // Modal logic for review
            window.openReviewModal = () => {
                const modal = document.getElementById('reviewModal');
                const overlay = document.getElementById('reviewOverlay');
                if (modal && overlay) {
                    overlay.classList.add('active');
                    modal.classList.add('active');
                }
            };

            window.closeReviewModal = () => {
                const modal = document.getElementById('reviewModal');
                const overlay = document.getElementById('reviewOverlay');
                if (modal && overlay) {
                    overlay.classList.remove('active');
                    modal.classList.remove('active');
                }
            };

            // Star Rating Logic
            const starSelect = document.getElementById('starSelect');
            const revRating = document.getElementById('revRating');
            if (starSelect) {
                const stars = starSelect.querySelectorAll('span');
                stars.forEach((star, idx) => {
                    star.addEventListener('click', () => {
                        const val = idx + 1;
                        revRating.value = val;
                        stars.forEach((s, i) => {
                            s.style.color = i < val ? 'gold' : '#ccc';
                        });
                    });
                });
            }

            window.submitDemoReview = (e) => {
                e.preventDefault();
                const name = document.getElementById('revName').value.trim() || 'Anonymous';
                const text = document.getElementById('revText').value.trim();
                const stars = parseInt(document.getElementById('revRating').value);
                
                const newReview = {
                    name: name,
                    initial: name.charAt(0).toUpperCase(),
                    stars: stars,
                    text: text
                };
                
                // Add to start of local storage
                localReviews.unshift(newReview);
                localStorage.setItem('my_reviews_' + product.slug, JSON.stringify(localReviews));
                
                // Add to display
                displayReviews.unshift(newReview);
                renderGrid();
                
                // Reset form and close
                e.target.reset();
                if (starSelect) {
                    const st = starSelect.querySelectorAll('span');
                    st.forEach((s, i) => s.style.color = i < 5 ? 'gold' : '#ccc');
                    revRating.value = 5;
                }
                closeReviewModal();
            };
        }
        
        // Tab Switching Logic
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = {
            features: document.getElementById('featuresTab'),
            howto: document.getElementById('howtoTab'),
            faq: document.getElementById('faqTab'),
            reviews: document.getElementById('reviewsTab')
        };
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                // Switch active button
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Switch visible content
                Object.keys(tabContents).forEach(key => {
                    if (tabContents[key]) {
                        tabContents[key].style.display = key === target ? 'block' : 'none';
                    }
                });
            });
        });

        // Finalize DOM
        lucide.createIcons();
        document.getElementById('loadingState').style.display = 'none';
        const container = document.getElementById('productContainer');
        container.style.display = 'block';
        setTimeout(() => container.classList.add('loaded'), 10);
        
    } catch (err) {
        console.error(err);
        showError(`Product not found or unavailable. <br><small style="color:var(--gray-500)">Try browsing from the <a href="/">homepage</a>.</small><br><br><small style="color:var(--danger)">Error: ${err.message}</small>`);
    }
});

function getOptimizedProductImageSrc(src) {
    if (!src || src.startsWith('http') || src.startsWith('data:image') || src.endsWith('.webp')) return src;
    const webpMap = {
        'netflix.png': 'netflix.webp',
        'brand-netflix.png': 'brand-netflix.webp',
        'prime.png': 'prime.webp',
        'brand-prime.png': 'brand-prime.webp',
        'hotstar.png': 'hotstar.webp',
        'brand-hotstar.png': 'brand-hotstar.webp',
        'zee5.png': 'brand-zee5.svg',
        'sonyliv.png': 'brand-sonyliv.svg',
        'applemusic.png': 'brand-apple-music.svg',
        'apple-music.png': 'brand-apple-music.svg',
        'appletv.png': 'appletv.webp',
        'spotify.png': 'spotify.webp',
        'brand-spotify.png': 'brand-spotify.webp',
        'youtube.png': 'youtube.webp',
        'chatgpt.png': 'chatgpt.webp',
        'claude.png': 'claude.webp',
        'canva.png': 'canva.webp',
        'nordvpn.png': 'nordvpn.webp',
        'logo-upgraded-20260603.png': 'logo-upgraded-20260603-small.webp'
    };
    return src.replace(/([^/\\]+\.png)$/i, file => webpMap[file.toLowerCase()] || file);
}

function getProductDisplayImage(product) {
    if (!product) return '';
    if (window.getProductLogoSrc) {
        return window.getProductLogoSrc(product);
    }
    const image = product.img || product.img_url || product.logo_url || product.product_img || product.platform?.logo_url || '';
    if (!image) return '';
    if (image.startsWith('http') || image.startsWith('/') || image.startsWith('data:image')) return image;
    return '/' + image.replace(/^\.?\//, '');
}

function toggleAccordion(btn) {
    const item = btn.parentElement;
    item.classList.toggle('active');
}

function showError(msg) {
    document.getElementById('loadingState').innerHTML = `
        <i data-lucide="x-circle" style="color:var(--danger); width:40px; height:40px;"></i>
        <p style="margin-top: 16px; color: var(--gray-800);">${msg}</p>
        <a href="/" class="btn btn-outline" style="margin-top: 12px; display:inline-block;">Return Home</a>
    `;
    lucide.createIcons();
}

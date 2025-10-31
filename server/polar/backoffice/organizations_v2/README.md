# Organizations V2 - Redesigned Backoffice Interface

## Overview

This is a **complete redesign** of the backoffice organization view with modern UX/UI patterns, improved workflows, and better code organization. It runs **alongside** the existing implementation at `/backoffice/organizations-v2/` allowing safe testing and gradual migration.

## 🎯 Design Goals Achieved

✅ **Reduced Cognitive Load** - Progressive disclosure, clear information hierarchy
✅ **Optimized for Speed** - Quick triage workflow, inline actions, smart grouping
✅ **Maintained Flexibility** - Deep investigation mode without losing quick actions
✅ **Modern UX Patterns** - Card-based layout, status-driven UI, contextual actions

## 🏗️ Architecture

### Directory Structure

```
organizations_v2/
├── endpoints.py              # Main router with list and detail endpoints
├── views/
│   ├── list_view.py         # Enhanced list view with tabs & smart grouping
│   ├── detail_view.py       # Three-column layout orchestrator
│   └── sections/
│       └── overview_section.py  # Overview section with review cards
└── actions/                 # (To be implemented) Action handlers
```

### Component Library (Reusable)

Created 8 new reusable components in `/backoffice/components/`:

1. **status_badge.py** - Semantic status indicators with icons
2. **metric_card.py** - Display key metrics with trends
3. **action_bar.py** - Flexible action button containers
4. **state.py** - Empty state, loading state, and card components
5. **confirmation_dialog.py** - Standardized confirmation modals
6. **tab_nav.py** - Tab navigation with counts and badges

## 🎨 UI/UX Improvements

### List View (`/backoffice/organizations-v2/`)

**New Features:**
- **Status-based tabs** with live counts (All, Under Review, Active, Denied)
- **"Needs Attention" smart grouping** surfaces urgent items:
  - Organizations under review >3 days
  - Pending appeals
  - High risk scores (≥80)
- **Inline quick actions** for common operations (approve/deny)
- **Rich organization cards** showing:
  - Days in status
  - Setup score (X/8)
  - Risk score with color coding
  - Appeal status
- **Real-time search** with 300ms debounce
- **Multiple sort options** (Priority, Newest, Recently Updated)

### Detail View (`/backoffice/organizations-v2/{id}`)

**Three-Column Layout:**

```
┌─────────────────────────────────────────────────┐
│  LEFT SIDEBAR  │  MAIN CONTENT  │  RIGHT SIDEBAR │
│  (Navigation)  │  (Section)     │  (Actions)     │
├────────────────┼────────────────┼────────────────┤
│  📊 Overview   │  Review Cards  │  ✅ Approve    │
│  👥 Team       │  Timeline      │  ❌ Deny       │
│  💳 Account    │                │  💬 Thread     │
│  📁 Files      │                │                │
│  📋 History    │                │  Metadata:     │
│  ⚙️  Settings   │                │  - Created     │
│                │                │  - Members     │
│                │                │  - Country     │
└────────────────┴────────────────┴────────────────┘
```

**Key Features:**
- **Persistent left navigation** for quick context switching
- **Contextual actions** adapt to organization status
- **Section-based content** loads on demand
- **Metadata sidebar** with quick reference info

### Overview Section

**Three Review Cards:**
1. **AI Review Verdict**
   - Pass/Fail/Uncertain badge
   - Risk score with color coding
   - Violated sections
   - Appeal information and status

2. **Setup Status (X/8)**
   - Visual progress bar
   - Checklist: Checkouts, Webhooks, API Keys, Products, Benefits
   - Verification status (User, Charges, Payouts)

3. **Payment Metrics**
   - Total payments & amount
   - P50/P90 risk scores
   - Refund rate with alerts
   - All metrics with color-coded variants

## 🔧 Technical Implementation

### Tech Stack
- **Backend**: Python 3.12+, FastAPI
- **HTML Generation**: Tagflow (context managers)
- **Styling**: Tailwind CSS 4 + DaisyUI 5
- **Dynamic UI**: HTMX for partial updates
- **Database**: SQLAlchemy (async) with PostgreSQL

### Code Quality Improvements

**Before (organizations/):**
- `endpoints.py`: 1830 lines (monolithic)
- Deep nesting (20+ levels)
- Mixed concerns (rendering + logic + data)
- Duplicated badge rendering
- Hard-coded values

**After (organizations_v2/):**
- Modular structure (~200 lines per file)
- Separation of concerns (views, sections, actions)
- Reusable components
- Type-safe interfaces
- Clear documentation

### Key Classes

**OrganizationListView**
```python
- get_status_counts() -> dict[OrganizationStatus, int]
- calculate_days_in_status(org) -> int
- is_needs_attention(org) -> bool
- organization_card(org, show_quick_actions) -> Generator
- render(request, orgs, status_filter, counts, pagination)
```

**OrganizationDetailView**
```python
- left_sidebar(request, current_section) -> Generator
- right_sidebar(request) -> Generator
- main_content(request, section) -> Generator
- render(request, section) -> Generator
```

**OverviewSection**
```python
- ai_review_card() -> Generator
- setup_card(setup_data) -> Generator
- payment_card(payment_stats) -> Generator
- render(request, setup_data, payment_stats) -> Generator
```

## 🚀 Usage

### Access the New Interface

Navigate to: **`/backoffice/organizations-v2/`**

The original interface remains at `/backoffice/organizations/` for comparison.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/backoffice/organizations-v2/` | GET | List view with filters |
| `/backoffice/organizations-v2/{id}` | GET | Detail view |
| `/backoffice/organizations-v2/{id}?section=overview` | GET | Overview section |
| `/backoffice/organizations-v2/{id}?section=team` | GET | Team section (TODO) |
| `/backoffice/organizations-v2/{id}?section=account` | GET | Account section (TODO) |
| `/backoffice/organizations-v2/{id}?section=files` | GET | Files section (TODO) |
| `/backoffice/organizations-v2/{id}?section=history` | GET | History/audit log (TODO) |
| `/backoffice/organizations-v2/{id}?section=settings` | GET | Settings section (TODO) |

### Query Parameters (List View)

- `status` - Filter by OrganizationStatus (under_review, active, denied)
- `q` - Search by name, slug, or email
- `sort` - Sort order (priority, created, updated)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

## 📋 TODO / Next Steps

### High Priority
1. **Action Endpoints** - Implement approve, deny, under-review actions
2. **Team Section** - Member management with inline editing
3. **Account Section** - Payment account details and setup
4. **Files Section** - File listing with download actions

### Medium Priority
5. **History Section** - Audit log of all organization changes
6. **Settings Section** - Organization details and feature flags
7. **Keyboard Shortcuts** - j/k navigation, shortcuts for actions
8. **Analytics Integration** - Fetch real setup_data and payment_stats

### Low Priority
9. **Saved Filters** - Preset filter combinations
10. **Bulk Actions** - Multi-select organizations for batch operations
11. **Export** - CSV/JSON export of organization list
12. **Advanced Search** - More filter options (date ranges, custom fields)

## 🎓 Design Patterns Used

### Progressive Disclosure
Information is revealed gradually:
- List view shows summary cards
- Detail view starts with overview
- Other sections load on demand
- Expandable/collapsible elements

### Status-Driven UI
Actions and styling adapt to organization state:
- Different actions for UNDER_REVIEW vs ACTIVE
- Color coding (green/yellow/red)
- Contextual warnings and alerts

### Smart Grouping
Automatically prioritizes items needing attention:
- "Needs Attention" section at top
- Clear visual indicators (border colors)
- Quick actions for rapid triage

### Component-Based Architecture
Reusable, composable building blocks:
- Each component is self-contained
- Consistent API (context managers)
- Easy to test and maintain

## 🔄 Migration Strategy

### Phase 1: Parallel Deployment (Current)
- ✅ New interface available at `/organizations-v2/`
- ✅ Old interface unchanged at `/organizations/`
- Users can test and provide feedback

### Phase 2: Feature Parity
- Implement all missing sections (Team, Account, Files, History, Settings)
- Implement all action endpoints
- Add keyboard shortcuts
- Performance testing

### Phase 3: Gradual Migration
- Redirect old URLs to new interface (with opt-out)
- Monitor usage and error rates
- Gather user feedback

### Phase 4: Deprecation
- Remove old interface
- Clean up old code
- Update documentation

## 📊 Success Metrics

**Quantitative:**
- Average review time: Target <2 min (baseline: ~5 min)
- Actions per page load: Target 3-5x improvement
- Error rate: Target <1%
- Page load time: <500ms

**Qualitative:**
- Admin satisfaction surveys
- Usability testing feedback
- Support ticket volume related to org management

## 🐛 Known Issues / Limitations

1. **Sections not implemented**: Team, Account, Files, History, Settings show placeholder text
2. **Action endpoints missing**: Approve, Deny, Under Review actions not wired up
3. **Analytics not integrated**: setup_data and payment_stats not fetched (shows None)
4. **No keyboard shortcuts yet**: Planned for future release
5. **Search is client-side**: Backend filtering only, no fuzzy search

## 🤝 Contributing

When extending this implementation:

1. **Follow the patterns**: Use context managers, Tagflow conventions
2. **Create reusable components**: Add to `/components/` if general-purpose
3. **Separate concerns**: Keep views, actions, and business logic separate
4. **Document your code**: Docstrings with types and examples
5. **Test thoroughly**: Both happy path and error cases

## 📚 Related Files

- Original implementation: `/server/polar/backoffice/organizations/`
- Shared components: `/server/polar/backoffice/components/`
- Analytics services: `/server/polar/backoffice/organizations/analytics.py`
- Models: `/server/polar/models/organization.py`

---

**Status**: ✅ Ready for testing
**Version**: 1.0.0
**Last Updated**: 2025-10-30
**Contact**: @petru (or file an issue)

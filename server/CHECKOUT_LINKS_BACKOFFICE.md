# Checkout Links Backoffice Implementation

## Overview

This implementation adds comprehensive backoffice functionality for managing checkout links, including the ability to browse all checkout links and restore deleted ones.

## Features Implemented

### 1. Backend Repository & Service Layer
- **Restore Functionality**: Added `restore()` method to both repository and service layers
- **Soft Delete Support**: Leverages existing soft deletion infrastructure (`deleted_at` field)
- **Enhanced Sorting**: Added organization sorting support to checkout link repository

### 2. Web Backoffice Module
- **List Page**: `/backoffice/checkout-links/`
  - Shows all active checkout links by default
  - Option to include deleted checkout links with `include_deleted=true` parameter
  - Search functionality by label, client secret, organization name/slug
  - Sortable columns (created date, label, organization)
  - Pagination support

- **Detail Page**: `/backoffice/checkout-links/{id}`
  - Shows comprehensive checkout link information
  - Displays associated organization and products
  - Shows restore button for deleted checkout links (when `deleted_at` is not null)

- **Restore Action**: `/backoffice/checkout-links/{id}/restore` (POST)
  - Restores soft-deleted checkout links
  - Redirects back to detail page after successful restoration
  - Includes proper error handling for invalid operations

### 3. Navigation Integration
- Added "Checkout Links" to the backoffice navigation menu
- Properly integrated with existing navigation patterns

### 4. Authentication & Authorization
- Uses existing admin authentication system (`get_admin` dependency)
- Requires admin user privileges to access the backoffice

## Testing

### Service Layer Tests
- ✅ Test checkout link restoration functionality
- ✅ Test restoring already active checkout links
- ✅ All existing checkout link tests continue to pass

### Integration Tests
- ✅ Verify routes are properly registered
- ✅ Verify navigation includes checkout links section
- ✅ Verify main app mounts backoffice correctly

### Manual Testing Notes
The web backoffice endpoints require admin authentication which isn't easily testable in the automated test suite. Manual testing can be performed by:

1. Starting the server with `uv run task api`
2. Logging in as an admin user
3. Visiting `/backoffice/checkout-links/` to test the functionality

## Files Modified/Created

### Modified Files
- `server/polar/checkout_link/repository.py` - Added restore method, sorting support
- `server/polar/checkout_link/service.py` - Added restore service method
- `server/polar/checkout_link/sorting.py` - Added organization sort property
- `server/polar/web_backoffice/__init__.py` - Added checkout links router
- `server/polar/web_backoffice/navigation.py` - Added navigation item

### New Files
- `server/polar/web_backoffice/checkout_links/` - Complete backoffice module
  - `__init__.py`
  - `components.py` - Table components for checkout links
  - `endpoints.py` - List, detail, and restore endpoints
- `server/tests/web_backoffice/` - Test module
  - `__init__.py`
  - `test_checkout_links.py` - Comprehensive test suite

## UI Components

The implementation uses the existing backoffice UI framework:
- Server-rendered HTML using tagflow
- Consistent styling with existing backoffice pages
- Reusable components (datatable, description lists, forms, buttons)
- Responsive design matching the orders page pattern

## Security & Audit Logging

- Admin-only access through existing authentication system
- Restore actions use the standard service layer for audit trail
- Proper error handling and validation
- No exposure of sensitive data in URLs or logs

## Performance Considerations

- Uses efficient database queries with proper joins and eager loading
- Pagination implemented for large datasets
- Includes deleted records only when explicitly requested
- Proper indexing on `deleted_at` field (inherited from base model)

## Future Enhancements

The implementation provides a solid foundation that could be extended with:
- Bulk restore operations
- More detailed audit logs
- Export functionality
- Advanced filtering options
- Real-time updates with websockets

This implementation follows the existing codebase patterns and provides a seamless integration with the current backoffice system.
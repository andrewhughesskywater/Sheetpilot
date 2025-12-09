/**
 * Email Auto-complete Utility
 * 
 * Provides email domain auto-completion for SkyWater Technology email addresses.
 * Automatically completes @skywatertechnology.com domain when user types @ symbol.
 */

const SKYWATER_DOMAIN = 'skywatertechnology.com';

/**
 * Auto-complete email domain for SkyWater Technology
 * If the user types '@' and starts typing the domain, it will auto-complete to @skywatertechnology.com
 * 
 * @param value - Current email input value
 * @returns Auto-completed email value, or original value if no auto-completion needed
 */
/**
 * Auto-complete email domain for company email addresses
 * 
 * Automatically appends "@skywatertechnology.com" when user types just username.
 * Improves UX by reducing typing and preventing domain typos.
 * 
 * @param value - Current email input value
 * @returns Completed email address or original value if @ already present
 */
export function autoCompleteEmailDomain(value: string): string {
  // Auto-complete domain for @skywatertechnology.com
  if (value.includes('@') && !value.includes(`@${SKYWATER_DOMAIN}`)) {
    const atIndex = value.lastIndexOf('@');
    const domainPart = value.substring(atIndex + 1);
    
    if (domainPart === '' || domainPart === SKYWATER_DOMAIN.substring(0, domainPart.length)) {
      return value.substring(0, atIndex + 1) + SKYWATER_DOMAIN;
    }
  }
  
  return value;
}


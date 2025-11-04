import { Box, Skeleton } from '@mui/material';

/**
 * Loading skeleton for the Timesheet page
 * Matches the layout structure of TimesheetGrid
 */
export default function TimesheetSkeleton() {
  return (
    <Box sx={{ p: 3, width: '100%', height: '100%' }}>
      {/* Submit button skeleton */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <Skeleton 
          variant="rectangular" 
          width={200} 
          height={48} 
          sx={{ borderRadius: 'var(--md-sys-shape-corner-full)' }} 
        />
      </Box>
      
      {/* Grid header skeleton */}
      <Box sx={{ mb: 2 }}>
        <Skeleton 
          variant="rectangular" 
          height={50} 
          sx={{ 
            borderRadius: 'var(--md-sys-shape-corner-medium)',
            mb: 1
          }} 
        />
      </Box>
      
      {/* Grid rows skeleton */}
      {[...Array(8)].map((_, index) => (
        <Skeleton 
          key={index}
          variant="rectangular" 
          height={40} 
          sx={{ 
            mb: 0.5,
            borderRadius: 'var(--md-sys-shape-corner-small)',
            animationDelay: `${index * 50}ms`
          }} 
        />
      ))}
      
      {/* Footer info skeleton */}
      <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'space-between' }}>
        <Skeleton variant="text" width={150} height={30} />
        <Skeleton variant="text" width={200} height={30} />
      </Box>
    </Box>
  );
}


import { Box, Skeleton } from '@mui/material';

/**
 * Loading skeleton for the Archive page
 * Matches the layout structure of DatabaseViewer
 */
export default function ArchiveSkeleton() {
  return (
    <Box sx={{ p: 3, width: '100%', height: '100%' }}>
      {/* Header with refresh button skeleton */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton 
          variant="rectangular" 
          width={120} 
          height={40} 
          sx={{ borderRadius: 'var(--md-sys-shape-corner-full)' }} 
        />
      </Box>
      
      {/* Grid container skeleton */}
      <Box 
        sx={{ 
          border: '1px solid var(--md-sys-color-outline-variant)',
          borderRadius: 'var(--md-sys-shape-corner-medium)',
          p: 2,
          background: 'var(--md-sys-color-surface-container-low)'
        }}
      >
        {/* Table header */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Skeleton variant="rectangular" width="10%" height={35} />
          <Skeleton variant="rectangular" width="12%" height={35} />
          <Skeleton variant="rectangular" width="12%" height={35} />
          <Skeleton variant="rectangular" width="12%" height={35} />
          <Skeleton variant="rectangular" width="25%" height={35} />
          <Skeleton variant="rectangular" width="15%" height={35} />
          <Skeleton variant="rectangular" width="14%" height={35} />
        </Box>
        
        {/* Table rows */}
        {[...Array(12)].map((_, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
            <Skeleton 
              variant="rectangular" 
              width="10%" 
              height={30} 
              sx={{ animationDelay: `${index * 40}ms` }}
            />
            <Skeleton 
              variant="rectangular" 
              width="12%" 
              height={30} 
              sx={{ animationDelay: `${index * 40}ms` }}
            />
            <Skeleton 
              variant="rectangular" 
              width="12%" 
              height={30} 
              sx={{ animationDelay: `${index * 40}ms` }}
            />
            <Skeleton 
              variant="rectangular" 
              width="12%" 
              height={30} 
              sx={{ animationDelay: `${index * 40}ms` }}
            />
            <Skeleton 
              variant="rectangular" 
              width="25%" 
              height={30} 
              sx={{ animationDelay: `${index * 40}ms` }}
            />
            <Skeleton 
              variant="rectangular" 
              width="15%" 
              height={30} 
              sx={{ animationDelay: `${index * 40}ms` }}
            />
            <Skeleton 
              variant="rectangular" 
              width="14%" 
              height={30} 
              sx={{ animationDelay: `${index * 40}ms` }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}


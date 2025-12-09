import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

/**
 * Loading skeleton for the Settings page
 * Matches the layout structure of Settings component
 */
export default function SettingsSkeleton() {
  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header skeleton */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Skeleton variant="text" width="40%" height={50} sx={{ mx: 'auto', mb: 1 }} />
        <Skeleton variant="text" width="60%" height={30} sx={{ mx: 'auto' }} />
      </Box>
      
      {/* Log Management Card skeleton */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Skeleton variant="text" width={200} height={35} />
          </Box>
          <Skeleton 
            variant="rectangular" 
            height={48} 
            sx={{ borderRadius: 'var(--md-sys-shape-corner-full)' }} 
          />
        </CardContent>
      </Card>
      
      {/* Credentials Management Card skeleton */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Skeleton variant="text" width={250} height={35} sx={{ mb: 2 }} />
          
          {/* Credentials display */}
          <Box sx={{ 
            mb: 2, 
            p: 2, 
            backgroundColor: 'var(--md-sys-color-surface-container-low)', 
            borderRadius: 'var(--md-sys-shape-corner-medium)' 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
              <Skeleton variant="text" width={200} height={24} />
            </Box>
            <Skeleton variant="text" width={180} height={20} />
          </Box>
          
          {/* Buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Skeleton 
              variant="rectangular" 
              width="50%" 
              height={48} 
              sx={{ borderRadius: 'var(--md-sys-shape-corner-full)' }} 
            />
            <Skeleton 
              variant="rectangular" 
              width="50%" 
              height={48} 
              sx={{ borderRadius: 'var(--md-sys-shape-corner-full)' }} 
            />
          </Box>
        </CardContent>
      </Card>
      
      {/* User Manual Section skeleton */}
      <Box sx={{ mt: 4 }}>
        <Skeleton variant="text" width={300} height={45} sx={{ mb: 3 }} />
        
        {/* Accordion skeletons */}
        {[...Array(4)].map((_, index) => (
          <Box 
            key={index}
            sx={{ 
              mb: 1, 
              border: '1px solid var(--md-sys-color-outline-variant)', 
              borderRadius: 'var(--md-sys-shape-corner-medium)',
              p: 2,
              animationDelay: `${index * 100}ms`
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Skeleton variant="circular" width={24} height={24} />
              <Skeleton variant="text" width="60%" height={30} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}


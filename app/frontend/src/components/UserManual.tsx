import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  gettingStartedSection,
  featuresSection,
} from "./manual/ManualSectionsGettingStartedAndFeatures";
import { workflowsSection } from "./manual/ManualSectionsWorkflows";
import { troubleshootingSection } from "./manual/ManualSectionsTroubleshooting";
import { supportSection } from "./manual/ManualSectionsSupport";
import { securitySection } from "./manual/ManualSectionsSecurity";
import "./UserManual.css";

export default function UserManual() {
  const [expandedSection, setExpandedSection] = useState<string | false>(
    "getting-started"
  );

  const handleChange =
    (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedSection(isExpanded ? panel : false);
    };

  const manualSections = [
    gettingStartedSection,
    featuresSection,
    workflowsSection,
    troubleshootingSection,
    securitySection,
    supportSection,
  ];

  return (
    <Box sx={{ width: "100%", maxWidth: "100%" }}>
      <Typography
        variant="h4"
        gutterBottom
        className="manual-heading manual-spacing-top"
      >
        SheetPilot User Manual
      </Typography>

      {manualSections.map((section, index) => (
        <Accordion
          key={section.id}
          expanded={expandedSection === section.id}
          onChange={handleChange(section.id)}
          className={`manual-accordion animate-on-enter-delay-${Math.min(
            index,
            4
          )}`}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            className="manual-accordion-summary"
            sx={{
              backgroundColor:
                expandedSection === section.id
                  ? "var(--md-sys-color-surface-container)"
                  : "transparent",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {section.icon}
              <Typography variant="h6" className="manual-heading">
                {section.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 3, pb: 3 }}>
            {section.content}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

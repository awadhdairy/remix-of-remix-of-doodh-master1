-- Add parent (sire/dam) columns to cattle table for pedigree tracking
ALTER TABLE public.cattle
ADD COLUMN sire_id UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
ADD COLUMN dam_id UUID REFERENCES public.cattle(id) ON DELETE SET NULL;

-- Add indexes for faster pedigree lookups
CREATE INDEX idx_cattle_sire_id ON public.cattle(sire_id);
CREATE INDEX idx_cattle_dam_id ON public.cattle(dam_id);

-- Add comment for documentation
COMMENT ON COLUMN public.cattle.sire_id IS 'Father (male parent) reference';
COMMENT ON COLUMN public.cattle.dam_id IS 'Mother (female parent) reference';